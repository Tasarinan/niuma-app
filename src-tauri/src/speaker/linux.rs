// Niuma linux speaker input and stream
use anyhow::{anyhow, Result};
use futures_util::Stream;
use std::collections::VecDeque;
use std::sync::{Arc, Mutex};
use std::task::{Poll, Waker};
use std::thread;

use libpulse_binding as pulse;
use libpulse_simple_binding as psimple;

use psimple::Simple;
use pulse::sample::{Format, Spec};
use pulse::stream::Direction;

const DEFAULT_SAMPLE_RATE: u32 = 44_100;

pub struct SpeakerInput {
    source_name: Option<String>,
}

impl SpeakerInput {
    pub fn new(device_id: Option<String>) -> Result<Self> {
        // For Linux, device_id is the PulseAudio source name
        Ok(Self {
            source_name: device_id,
        })
    }

    pub fn stream(self) -> SpeakerStream {
        let sample_queue = Arc::new(Mutex::new(VecDeque::new()));
        let waker_state = Arc::new(Mutex::new(WakerState {
            waker: None,
            has_data: false,
            shutdown: false,
        }));
        let (init_tx, init_rx) = std::sync::mpsc::channel();

        let queue_clone = sample_queue.clone();
        let waker_clone = waker_state.clone();
        let source_name = self.source_name;

        let mut capture_thread = Some(thread::spawn(move || {
            if let Err(e) = SpeakerStream::capture_audio_loop(
                queue_clone,
                waker_clone,
                source_name.as_deref(),
                init_tx,
            ) {
                eprintln!("Audio capture loop failed: {}", e);
            }
        }));

        let (sample_rate, init_success) = match init_rx.recv() {
            Ok(Ok(sr)) => (sr, true),
            Ok(Err(e)) => {
                eprintln!("Audio initialization failed: {}", e);
                (DEFAULT_SAMPLE_RATE, false)
            }
            Err(e) => {
                eprintln!("Failed to receive audio init signal: {}", e);
                (DEFAULT_SAMPLE_RATE, false)
            }
        };

        if !init_success {
            {
                let mut state = waker_state.lock().unwrap();
                state.shutdown = true;
                if let Some(waker) = state.waker.take() {
                    drop(state);
                    waker.wake();
                }
            }

            if let Some(handle) = capture_thread.take() {
                let _ = handle.join();
            }
        }

        SpeakerStream {
            sample_queue,
            waker_state,
            capture_thread,
            sample_rate,
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
    sample_rate: u32,
}

impl SpeakerStream {
    pub fn sample_rate(&self) -> u32 {
        self.sample_rate
    }

    fn capture_audio_loop(
        sample_queue: Arc<Mutex<VecDeque<f32>>>,
        waker_state: Arc<Mutex<WakerState>>,
        source_name: Option<&str>,
        init_tx: std::sync::mpsc::Sender<Result<u32>>,
    ) -> Result<()> {
        let spec = Spec {
            format: Format::F32le,
            channels: 1,
            rate: 44100, // Fixed: Use 44100 Hz to match macOS/Windows
        };

        if !spec.is_valid() {
            return Err(anyhow!("Invalid audio specification"));
        }

        let source_name = source_name
            .map(|s| s.to_string())
            .or_else(get_default_monitor_source);

        let init_result: Result<(Simple, u32)> = (|| {
            let simple = Simple::new(
                None,                   // Use default server
                "Niuma",                // Application name
                Direction::Record,      // Record direction
                source_name.as_deref(), // Source name (monitor)
                "System Audio Capture", // Stream description
                &spec,                  // Sample specification
                None,                   // Channel map (use default)
                None,                   // Buffer attributes (use default)
            )
            .map_err(|e| anyhow!("Failed to create PulseAudio simple connection: {}", e))?;

            Ok((simple, spec.rate))
        })();

        match init_result {
            Ok((simple, sample_rate)) => {
                let _ = init_tx.send(Ok(sample_rate));

                // Buffer for reading audio data
                let mut buffer = vec![0u8; 4096]; // 1024 f32 samples * 4 bytes each

                loop {
                    if waker_state.lock().unwrap().shutdown {
                        break;
                    }

                    match simple.read(&mut buffer) {
                        Ok(_) => {
                            // Convert byte buffer to f32 samples
                            let samples: Vec<f32> = buffer
                                .chunks_exact(4)
                                .map(|chunk| {
                                    f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]])
                                })
                                .collect();

                            if !samples.is_empty() {
                                // Consistent buffer overflow handling
                                let dropped = {
                                    let mut queue = sample_queue.lock().unwrap();
                                    let max_buffer_size = 131072; // 128KB buffer (matching macOS/Windows)

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
                                    eprintln!(
                                        "Linux buffer overflow - dropped {} samples",
                                        dropped
                                    );
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
                        Err(e) => {
                            eprintln!("PulseAudio read error: {}", e);
                            thread::sleep(std::time::Duration::from_millis(100));
                        }
                    }
                }
            }
            Err(e) => {
                let _ = init_tx.send(Err(e));
            }
        }
        Ok(())
    }
}

fn get_default_monitor_source() -> Option<String> {
    Some("@DEFAULT_MONITOR@".to_string())
}

impl Drop for SpeakerStream {
    fn drop(&mut self) {
        {
            let mut state = self.waker_state.lock().unwrap();
            state.shutdown = true;
            if let Some(waker) = state.waker.take() {
                waker.wake();
            }
        }
        if let Some(thread) = self.capture_thread.take() {
            let _ = thread.join();
        }
    }
}

impl Stream for SpeakerStream {
    type Item = f32;

    fn poll_next(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> Poll<Option<Self::Item>> {
        let mut queue = self.sample_queue.lock().unwrap();
        if let Some(sample) = queue.pop_front() {
            return Poll::Ready(Some(sample));
        }

        let mut state = self.waker_state.lock().unwrap();
        if state.shutdown {
            return Poll::Ready(None);
        }

        state.has_data = false;
        state.waker = Some(cx.waker().clone());
        Poll::Pending
    }
}
