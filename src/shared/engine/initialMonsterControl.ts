import { CardLocation } from '../constants/locations'
import type { FieldCard } from '../types/duel'

export function needsInitialMonsterControl(cards: FieldCard[]): boolean {
  return cards.some(
    (card) =>
      card.location === CardLocation.MZONE && (card.owner ?? card.controller) !== card.controller
  )
}

export const INITIAL_MONSTER_CONTROL_SCRIPT = `do
  local monsters = Duel.GetFieldGroup(0, LOCATION_MZONE, LOCATION_MZONE)
  local card = monsters:GetFirst()
  while card do
    local controller = card:GetControler()
    if card:GetOwner() ~= controller and not card:IsHasEffect(EFFECT_SET_CONTROL) then
      local control = Effect.CreateEffect(card)
      control:SetType(EFFECT_TYPE_SINGLE)
      control:SetCode(EFFECT_SET_CONTROL)
      control:SetProperty(EFFECT_FLAG_CANNOT_DISABLE)
      control:SetValue(controller)
      control:SetReset(RESET_EVENT + RESET_TOGRAVE + RESET_REMOVE + RESET_TOHAND + RESET_TODECK + RESET_OVERLAY + RESET_MSCHANGE)
      card:RegisterEffect(control)
    end
    card = monsters:GetNext()
  end
end`
