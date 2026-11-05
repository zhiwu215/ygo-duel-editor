import {
  MeasuringStrategy,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  type Modifier,
  type Modifiers
} from '@dnd-kit/core'

export const SORTABLE_TRANSITION = { duration: 160, easing: 'cubic-bezier(0.2, 0, 0, 1)' }

export const DROP_ANIMATION = { duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }

export const SORTABLE_MEASURING = { droppable: { strategy: MeasuringStrategy.BeforeDragging } }

export const pointerFirstCollisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  return hits.length > 0 ? hits : rectIntersection(args)
}

const centerDragPreviewOnCursor: Modifier = ({
  activatorEvent,
  draggingNodeRect,
  overlayNodeRect,
  transform
}) => {
  if (!draggingNodeRect || !overlayNodeRect || !(activatorEvent instanceof MouseEvent)) {
    return transform
  }
  return {
    ...transform,
    x: transform.x + activatorEvent.clientX - draggingNodeRect.left - overlayNodeRect.width / 2,
    y: transform.y + activatorEvent.clientY - draggingNodeRect.top - overlayNodeRect.height / 2
  }
}

export const DRAG_OVERLAY_MODIFIERS: Modifiers = [centerDragPreviewOnCursor]
