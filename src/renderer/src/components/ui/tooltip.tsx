import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip'

function TooltipProvider({ delay = 400, ...props }: TooltipPrimitive.Provider.Props) {
  return <TooltipPrimitive.Provider data-slot="tooltip-provider" delay={delay} {...props} />
}

function Tooltip({ ...props }: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent(props: TooltipPrimitive.Popup.Props): null {
  void props
  return null
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
