// Niuma windows speaker input and stream
use anyhow::Result;
use futures_util::Stream;
use std::collections::VecDeque;
use std::sync::{mpsc, Arc, Mutex};
use std::task::{Poll, Waker};
use std::thread;
use std::time::Duration;
use tracing::error;
use wasapi::{get_default_device, Direction, SampleType, StreamMode, WaveFormat};

pub struct SpeakerInput {
    device_index: Option<usize>,
}

impl SpeakerInput {
    pub fn new(device_id: Option<String>) -> Result<Self> {
        let device_index = device_id.and_then(|id| {
            id.strip_prefix("windows_output_")
                .and_then(|s| s.parse::<usize>().ok())
        });

        Ok(Self { device_index })
    }

    // Starts the audio stream
    pub fn stream(self) -> SpeakerStream {
        let sample_queue = Arc::new(Mutex::new(VecDeque::new()));
        let waker_state = Arc::new(Mutex::new(WakerState {
            waker: None,
            has_data: false,
            shutdown: false,
        }));
        let (init_tx, init_rx) = mpsc::channel();

        let queue_clone = sample_queue.clone();
        let waker_clone = waker_state.clone();
        let device_index = self.device_index;

        let capture_thread = thread::spawn(move || {
            if let Err(e) =
                SpeakerStream::capture_audio_loop(queue_clone, waker_clone, init_tx, device_index)
            {
                error!("Niuma Audio capture loop failed: {}", e);
            }
        });

        let actual_sample_rate = match init_rx.recv_timeout(Duration::from_secs(5)) {
            Ok(Ok(rate)) => rate,
            Ok(Err(e)) => {
                error!("Niuma Audio initialization failed: {}", e);
                44100
            }
            Err(_) => {
                error!("Niuma Audio initialization timeout");
                44100
            }
        };

        SpeakerStream {
            sample_queue,
            waker_state,
            capture_thread: Some(capture_thread),
            actual_sample_rate,
        }
    }
}

struct WakerState {
    waker: Option<Waker>,
    has_data: bool,
    shutdown: bool,
}

pub struct SpeakerStream {
    sample_queue: Arc<Mutex<VecDeque<f32>>>,
    waker_state: Arc<Mutex<WakerState>>,
    capture_thread: Option<thread::JoinHandle<()>>,
    actual_sample_rate: u32,
}

impl SpeakerStream {
    pub fn sample_rate(&self) -> u32 {
        self.actual_sample_rate
    }

    fn capture_audio_loop(
        sample_queue: Arc<Mutex<VecDeque<f32>>>,
        waker_state: Arc<Mutex<WakerState>>,
        init_tx: mpsc::Sender<Result<u32>>,
        device_index: Option<usize>,
    ) -> Result<()> {
        let init_result = (|| -> Result<_> {
            let device = match device_index {
                Some(index) => {
                    use wasapi::DeviceCollection;
                    let collection = DeviceCollection::new(&Direction::Render)?;
                    collection.get_device_at_index(index.try_into()?)?
                }
                None => get_default_device(&Direction::Render)?,
            };
            let mut audio_client = device.get_iaudioclient()?;

            let device_format = audio_client.get_mixformat()?;
            let actual_rate = device_format.get_samplespersec();

            let desired_format =
                WaveFormat::new(32, 32, &SampleType::Float, actual_rate as usize, 1, None);

            let (_def_time, min_time) = audio_client.get_device_period()?;

            let mode = StreamMode::EventsShared {
                autoconvert: true,
                buffer_duration_hns: min_time,
            };

            audio_client.initialize_client(&desired_format, &Direction::Capture, &mode)?;

            let h_event = audio_client.set_get_eventhandle()?;
            let render_client = audio_client.get_audiocaptureclient()?;

            audio_client.start_stream()?;

            Ok((h_event, render_client, actual_rate))
        })();

        match init_result {
            Ok((h_event, render_client, sample_rate)) => {
                let _ = init_tx.send(Ok(sample_rate));

                loop {
                    {
                        let state = waker_state.lock().unwrap();
                        if state.shutdown {
                            break;
                        }
                    }

                    if h_event.wait_for_event(3000).is_err() {
                        error!("Niuma timeout error, stopping capture");
                        break;
                    }

                    let mut temp_queue = VecDeque::new();
                    if let Err(e) = render_client.read_from_device_to_deque(&mut temp_queue) {
                        error!("Niuma Failed to read audio data: {}", e);
                        continue;
                    }

                    if temp_queue.is_empty() {
                        continue;
                    }

                    let mut samples = Vec::new();
                    while temp_queue.len() >= 4 {
                        let bytes = [
                            temp_queue.pop_front().unwrap(),
                            temp_queue.pop_front().unwrap(),
                            temp_queue.pop_front().unwrap(),
                            temp_queue.pop_front().unwrap(),
                        ];
                        let sample = f32::from_le_bytes(bytes);
                        samples.push(sample);
                    }

                    if !samples.is_empty() {
                        // Consistent buffer overflow handling
                        let dropped = {
                            let mut queue = sample_queue.lock().unwrap();
                            let max_buffer_size = 131072; // 128KB buffer (matching macOS)

                            queue.extend(samples.iter());

                            // If buffer exceeds maximum, drop oldest samples
                            let dropped_count = if queue.len() > max_buffer_size {
                                let to_drop = queue.len() - max_buffer_size;
                                queue.drain(0..to_drop);
                                to_drop
                            } else {
                                0
                            };

                            dropped_count
                        };

                        if dropped > 0 {
                            error!("Windows buffer overflow - dropped {} samples", dropped);
                        }

                        // Wake up consumer
                        {
                            let mut state = waker_state.lock().unwrap();
                            if !state.has_data {
                                state.has_data = true;
                                if let Some(waker) = state.waker.take() {
                                    drop(state);
                                    waker.wake();
                                }
                            }
                        }
                    }
                }
            }
            Err(e) => {
                let _ = init_tx.send(Err(e));
                return Ok(());
            }
        }

        Ok(())
    }
}

// Drops the audio stream
impl Drop for SpeakerStream {
    fn drop(&mut self) {
        {
            let mut state = self.waker_state.lock().unwrap();
            state.shutdown = true;
        }

        if let Some(thread) = self.capture_thread.take() {
            if let Err(e) = thread.join() {
                error!("Failed to join capture thread: {:?}", e);
            }
        }
    }
}

// Stream of f32 audio samples from the speaker
impl Stream for SpeakerStream {
    type Item = f32;

    // Polls the audio stream
    fn poll_next(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> Poll<Option<Self::Item>> {
        {
            let state = self.waker_state.lock().unwrap();
            if state.shutdown {
                return Poll::Ready(None);
            }
        }

        {
            let mut queue = self.sample_queue.lock().unwrap();
            if let Some(sample) = queue.pop_front() {
                return Poll::Ready(Some(sample));
            }
        }

        {
            let mut state = self.waker_state.lock().unwrap();
            if state.shutdown {
                return Poll::Ready(None);
            }
            state.has_data = false;
            state.waker = Some(cx.waker().clone());
            drop(state);
        }

        {
            let mut queue = self.sample_queue.lock().unwrap();
            match queue.pop_front() {
                Some(sample) => Poll::Ready(Some(sample)),
                None => Poll::Pending,
            }
        }
    }
}
