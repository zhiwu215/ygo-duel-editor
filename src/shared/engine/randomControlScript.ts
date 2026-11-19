export const TOSS_REGISTRY_KEY = 'yde_random_toss'
export const ASK_REGISTRY_KEY = 'yde_random_ask'

export const RANDOM_SELECTION_SCRIPT = `
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
`

export const CONTROL_SCRIPT = `${RANDOM_SELECTION_SCRIPT}
local unpack_values = table.unpack or unpack

local function record_toss(kind, tp, values)
	if not Duel.SetRegistryValue then return end
	local previous = Duel.GetRegistryValue('${TOSS_REGISTRY_KEY}') or ''
	local entry = kind .. ':' .. tp .. ':' .. table.concat(values, ',')
	Duel.SetRegistryValue('${TOSS_REGISTRY_KEY}', previous == '' and entry or previous .. '\\n' .. entry)
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
	count2 = count2 or 0
	local total = count1 + count2
	local results = {}
	for i = 1, total do
		mark_ask()
		results[i] = Duel.AnnounceNumber(tp, 1, 2, 3, 4, 5, 6)
		clear_ask()
	end
	local first = {unpack_values(results, 1, count1)}
	record_toss('dice', tp, first)
	if count2 > 0 then
		record_toss('dice', 1 - tp, {unpack_values(results, count1 + 1, total)})
	end
	return unpack_values(results)
end
`
