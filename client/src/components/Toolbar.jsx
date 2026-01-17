import {
  Pencil,
  Eraser,
  Square,
  Circle as EllipseIcon,
  Trash2,
  Download,
  Type,
  MoveUpRight,
  Undo2,
  Redo2,
} from "lucide-react";

const Toolbar = ({
  color,
  setColor,
  setLineWidth,
  setTool,
  activeTool,
  onUndo,
  onRedo,
  onClear,
  onDownload,
}) => {
  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center gap-4 px-6 py-3 bg-white/80 backdrop-blur-sm shadow-xl border border-black rounded-full w-max">
      {/* Tools Group */}
      <div className="flex gap-2 items-center">
        <IconButton
          icon={<Pencil size={18} />}
          active={activeTool === "pencil"}
          onClick={() => setTool("pencil")}
        />
        <IconButton
          icon={<Eraser size={18} />}
          active={activeTool === "eraser"}
          onClick={() => setTool("eraser")}
        />
        <IconButton
          icon={<MoveUpRight size={18} />}
          active={activeTool === "arrow"}
          onClick={() => setTool("arrow")}
        />
        <IconButton
          icon={<Square size={18} />}
          active={activeTool === "rect"}
          onClick={() => setTool("rect")}
        />
        <IconButton
          icon={<EllipseIcon size={18} className="scale-x-125" />}
          active={activeTool === "ellipse"}
          onClick={() => setTool("ellipse")}
        />
        <IconButton
          icon={<Type size={18} />}
          active={activeTool === "text"}
          onClick={() => setTool("text")}
        />
      </div>

      <div className="h-6 w-[1px] bg-gray-300 mx-2" />

      {/* Settings Group */}
      <div className="flex gap-4 items-center">
        {/* Circular Color Picker */}
        <div className="relative w-8 h-8 rounded-full overflow-hidden border border-gray-200 shadow-sm">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="absolute -top-1 -left-1 w-[150%] h-[150%] cursor-pointer border-none p-0"
            style={{ backgroundColor: color }}
          />
        </div>

        <input
          type="range"
          min="1"
          max="25"
          defaultValue="5"
          onChange={(e) => setLineWidth(e.target.value)}
          className="w-24 accent-black h-1.5 bg-gray-200 rounded-lg cursor-pointer"
        />
      </div>

      <IconButton icon={<Undo2 size={18} />} onClick={onUndo} />
      <IconButton icon={<Redo2 size={18} />} onClick={onRedo} />

      <div className="h-6 w-[1px] bg-gray-300 mx-2" />

      {/* Actions Group */}
      <div className="flex gap-2 items-center">
        <button
          onClick={onClear}
          className="p-2.5 bg-white hover:bg-red-50 text-gray-700 hover:text-red-600 rounded-full transition-all border border-gray-100"
        >
          <Trash2 size={18} />
        </button>
        <button
          onClick={onDownload}
          className="p-2.5 bg-black text-white hover:bg-gray-800 rounded-full transition-all shadow-md"
        >
          <Download size={18} />
        </button>
      </div>
    </div>
  );
};

const IconButton = ({ icon, active, onClick }) => (
  <button
    onClick={onClick}
    className={`p-2.5 rounded-full transition-all shadow-sm ${
      active
        ? "bg-blue-600 text-white scale-110"
        : "bg-black text-white hover:bg-gray-800"
    }`}
  >
    {icon}
  </button>
);

export default Toolbar;
