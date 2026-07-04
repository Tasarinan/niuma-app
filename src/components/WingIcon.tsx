interface WingIconProps {
  className?: string;
}

export const WingIcon = ({ className = "h-4 w-4" }: WingIconProps) => {
  return (
    <img
      src="/icon.png"
      alt="Niuma logo"
      className={className}
    />
  );
};
