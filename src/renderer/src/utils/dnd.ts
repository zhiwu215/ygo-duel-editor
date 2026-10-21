import {
  MeasuringStrategy,
  pointerWithin,
  rectIntersection,
  type CollisionDetection
} from '@dnd-kit/core'

export const SORTABLE_TRANSITION = { duration: 160, easing: 'cubic-bezier(0.2, 0, 0, 1)' }

export const DROP_ANIMATION = { duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }

export const SORTABLE_MEASURING = { droppable: { strategy: MeasuringStrategy.BeforeDragging } }

export const pointerFirstCollisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  return hits.length > 0 ? hits : rectIntersection(args)
}
