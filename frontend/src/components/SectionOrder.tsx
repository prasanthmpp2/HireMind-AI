import { DragDropContext, Draggable, DropResult } from "react-beautiful-dnd";
import { GripVertical } from "lucide-react";
import { SectionKey } from "../types/resume";
import { sectionLabels } from "../lib/resume";
import { StrictModeDroppable } from "./StrictModeDroppable";

type SectionOrderProps = {
  order: SectionKey[];
  onReorder: (order: SectionKey[]) => void;
};

export const SectionOrder = ({ order, onReorder }: SectionOrderProps) => {
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(order);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    onReorder(items);
  };

  return (
    <div className="glass-card p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
        Arrangement
      </p>
      <h3 className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">Section Order</h3>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Drag to reorder sections in the preview.</p>
      <DragDropContext onDragEnd={handleDragEnd}>
        <StrictModeDroppable droppableId="sections">
          {(provided) => (
            <ul ref={provided.innerRef} {...provided.droppableProps} className="mt-3 space-y-2.5">
              {order.map((section, index) => (
                <Draggable key={section} draggableId={section} index={index}>
                  {(dragProvided) => (
                    <li
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white/70 px-3 py-2 text-sm text-slate-700 shadow-sm transition hover:translate-y-[-1px] hover:shadow-md dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-200"
                    >
                      <span {...dragProvided.dragHandleProps} className="rounded-md bg-slate-100 p-1 text-slate-400 dark:bg-slate-800">
                        <GripVertical className="h-4 w-4" />
                      </span>
                      {sectionLabels[section]}
                    </li>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </ul>
          )}
        </StrictModeDroppable>
      </DragDropContext>
    </div>
  );
};
