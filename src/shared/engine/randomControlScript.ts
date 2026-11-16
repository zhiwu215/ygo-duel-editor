export const TOSS_REGISTRY_KEY = 'yde_random_toss'
export const ASK_REGISTRY_KEY = 'yde_random_ask'

export const CONTROL_SCRIPT = `
local unpack_values = table.unpack or unpack

local function record_toss(kind, tp, values)
	if Duel.SetRegistryValue then
		Duel.SetRegistryValue('${TOSS_REGISTRY_KEY}', kind .. ':' .. tp .. ':' .. table.concat(values, ','))
	end
end

local function mark_ask()
	if Duel.SetRegistryValue then
		Duel.SetRegistryValue('${ASK_REGISTRY_KEY}', '1')
	end
end

local function clear_ask()
	if Duel.SetRegistryValue then
		Duel.SetRegistryValue('${ASK_REGISTRY_KEY}', '')
	end
end

local original_random_select = Group.RandomSelect
function Group:RandomSelect(tp, count)
	if count > 0 and self:GetCount() > count then
		mark_ask()
		local chosen = self:Select(tp, count, count, nil)
		clear_ask()
		if chosen and chosen:GetCount() == count then
			return chosen
		end
	end
	return original_random_select(self, tp, count)
end

function Duel.TossCoin(tp, count)
	local results = {}
	for i = 1, count do
		mark_ask()
		local choice = Duel.SelectOption(tp, 60, 61)
		clear_ask()
		if choice == 0 then
			results[i] = 1
		else
			results[i] = 0
		end
	end
	record_toss('coin', tp, results)
	return unpack_values(results)
end

function Duel.TossDice(tp, count1, count2)
	local total = count1 + (count2 or 0)
	local results = {}
	for i = 1, total do
		mark_ask()
		results[i] = Duel.AnnounceNumber(tp, 1, 2, 3, 4, 5, 6)
		clear_ask()
	end
	record_toss('dice', tp, results)
	return unpack_values(results)
end
`
