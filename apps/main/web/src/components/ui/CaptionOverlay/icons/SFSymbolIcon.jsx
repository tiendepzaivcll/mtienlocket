const SFSymbolIcon = ({ data, color }) => {
  return (
    <span
      aria-label={data}
      className="inline-flex h-6 w-6 items-center justify-center"
      style={{ color }}
      title={data}
    >
      ●
    </span>
  );
};

export default SFSymbolIcon;
