import SPELLS from 'common/SPELLS';
import TALENTS from 'common/TALENTS/warlock';
import { EventType } from 'parser/core/Events';
import { Condition, tenseAlt } from 'parser/shared/metrics/apl';
import { formatRange, Range } from 'parser/shared/metrics/apl/conditions';
import { encodeEventSourceString, encodeEventTargetString } from 'parser/shared/modules/Enemies';

const FIREBOLTS_PER_IMP = 6;
const FALLBACK_LIFETIME_MS = 15000;
const IMPLOSION_MAX_IMPS = 6;
const POWER_SIPHON_IMPS = 2;
const IMP_SUMMONS = [SPELLS.WILD_IMP_HOG_SUMMON.id, SPELLS.WILD_IMP_ID_SUMMON.id];

interface Imp {
  key: string;
  bolts: number;
  expiry: number;
}

const isAlive = (imp: Imp, timestamp: number) =>
  imp.bolts < FIREBOLTS_PER_IMP && imp.expiry > timestamp;

// the in-game Wild Imp count aura isn't in the combat log, so track each imp from its summon until its 6th Fel Firebolt
// ponytail: the 15s fallback only matters if an imp's casts are missing from the log
export default function wildImpCount(range: Range): Condition<Imp[]> {
  return {
    key: `wildImpCount-${range.atLeast}-${range.atMost}`,
    init: () => [],
    update: (state, event) => {
      const live = state.filter((imp) => isAlive(imp, event.timestamp));
      if (event.type === EventType.Summon && IMP_SUMMONS.includes(event.ability.guid)) {
        const key = encodeEventTargetString(event);
        return [
          ...live.filter((imp) => imp.key !== key),
          { key, bolts: 0, expiry: event.timestamp + FALLBACK_LIFETIME_MS },
        ];
      }
      if (event.type === EventType.Cast && event.ability.guid === SPELLS.FEL_FIREBOLT.id) {
        const key = encodeEventSourceString(event);
        return live
          .map((imp) => (imp.key === key ? { ...imp, bolts: imp.bolts + 1 } : imp))
          .filter((imp) => isAlive(imp, event.timestamp));
      }
      if (event.type === EventType.Cast && event.ability.guid === SPELLS.IMPLOSION_CAST.id) {
        return live.slice(IMPLOSION_MAX_IMPS);
      }
      if (event.type === EventType.Cast && event.ability.guid === TALENTS.POWER_SIPHON_TALENT.id) {
        return live.slice(POWER_SIPHON_IMPS);
      }
      return live;
    },
    validate: (state, event) => {
      const count = state.filter((imp) => isAlive(imp, event.timestamp)).length;
      return count >= (range.atLeast ?? 0) && (range.atMost === undefined || count <= range.atMost);
    },
    describe: (tense) => (
      <>
        you {tenseAlt(tense, 'have', 'had')} {formatRange(range)} Wild Imps
      </>
    ),
  };
}
