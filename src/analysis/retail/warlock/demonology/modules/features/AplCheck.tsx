import SPELLS from 'common/SPELLS';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';
import { SpellLink } from 'interface';
import { suggestion } from 'parser/core/Analyzer';
import { AnyEvent } from 'parser/core/Events';
import aplCheck, { Apl, build, CheckResult, PlayerInfo, tenseAlt } from 'parser/shared/metrics/apl';
import annotateTimeline from 'parser/shared/metrics/apl/annotate';
import * as cnd from 'parser/shared/metrics/apl/conditions';
import talents from 'common/TALENTS/warlock';
import wildImpCount from './WildImpCount';

const DOMINION_HOG = {
  spell: SPELLS.HAND_OF_GULDAN_CAST,
  condition: cnd.and(
    cnd.buffPresent(SPELLS.DOMINION_OF_ARGUS_BUFF),
    cnd.hasResource(RESOURCE_TYPES.SOUL_SHARDS, { atLeast: 3 }),
  ),
};

const CORE_DURATION_MS = 20000;

// holding cores for Tyrant depends on Dreadstalkers timing, so either choice is fine (this purposefully differs from SimC)
const DEMONBOLT_CORE_HOLD = {
  spell: SPELLS.DEMONBOLT,
  condition: cnd.optionalRule(
    cnd.and(
      cnd.hasResource(RESOURCE_TYPES.SOUL_SHARDS, { atMost: 3 }),
      cnd.buffPresent(SPELLS.DEMONIC_CORE_BUFF),
      cnd.spellCooldownRemaining(SPELLS.SUMMON_DEMONIC_TYRANT, { atMost: CORE_DURATION_MS }),
    ),
  ),
};

const DEMONBOLT_CORE = {
  spell: SPELLS.DEMONBOLT,
  condition: cnd.describe(
    cnd.and(
      cnd.hasResource(RESOURCE_TYPES.SOUL_SHARDS, { atMost: 3 }),
      cnd.buffPresent(SPELLS.DEMONIC_CORE_BUFF),
      cnd.not(
        cnd.spellCooldownRemaining(SPELLS.SUMMON_DEMONIC_TYRANT, { atMost: CORE_DURATION_MS }),
      ),
    ),
    (tense) => (
      <>
        you {tenseAlt(tense, 'have', 'had')} <SpellLink spell={SPELLS.DEMONIC_CORE_BUFF} /> and 3 or
        fewer Soul Shards, and <SpellLink spell={SPELLS.SUMMON_DEMONIC_TYRANT} />{' '}
        {tenseAlt(tense, "isn't", "wasn't")} due within {CORE_DURATION_MS / 1000}s
      </>
    ),
  ),
};

// Dreadstalkers (20s CD) normally line up with Tyrant (60s); if they drift, holding them for Tyrant is fine
const DREADSTALKERS_HOLD = {
  spell: SPELLS.CALL_DREADSTALKERS,
  condition: cnd.optionalRule(
    cnd.describe(
      cnd.spellCooldownRemaining(SPELLS.SUMMON_DEMONIC_TYRANT, { atLeast: 10500, atMost: 21500 }),
      (tense) => (
        <>
          holding them {tenseAlt(tense, 'will', 'would')} line them up better with{' '}
          <SpellLink spell={SPELLS.SUMMON_DEMONIC_TYRANT} />
        </>
      ),
    ),
  ),
};

const DREADSTALKERS = {
  spell: SPELLS.CALL_DREADSTALKERS,
  condition: cnd.describe(
    cnd.not(
      cnd.spellCooldownRemaining(SPELLS.SUMMON_DEMONIC_TYRANT, { atLeast: 10500, atMost: 21500 }),
    ),
    (tense) => (
      <>
        they {tenseAlt(tense, 'will', 'would')} still line up with{' '}
        <SpellLink spell={SPELLS.SUMMON_DEMONIC_TYRANT} />
      </>
    ),
  ),
};

const IMPLOSION = {
  spell: SPELLS.IMPLOSION_CAST,
  condition: cnd.and(wildImpCount({ atLeast: 6 }), cnd.hasTalent(talents.TO_HELL_AND_BACK_TALENT)),
};

const soulHarvesterApl = build([
  DOMINION_HOG,
  talents.GRIMOIRE_IMP_LORD_TALENT,
  DREADSTALKERS_HOLD,
  DREADSTALKERS,
  SPELLS.SUMMON_DEMONIC_TYRANT,
  IMPLOSION,
  {
    spell: SPELLS.HAND_OF_GULDAN_CAST,
    condition: cnd.hasResource(RESOURCE_TYPES.SOUL_SHARDS, { atLeast: 3 }),
  },
  DEMONBOLT_CORE_HOLD,
  DEMONBOLT_CORE,
  SPELLS.SHADOW_BOLT_DEMO,
]);

const diabolistApl = build([
  DOMINION_HOG,
  talents.GRIMOIRE_IMP_LORD_TALENT,
  DREADSTALKERS_HOLD,
  DREADSTALKERS,
  {
    spell: SPELLS.SUMMON_DEMONIC_TYRANT,
    condition: cnd.hasResource(RESOURCE_TYPES.SOUL_SHARDS, { atLeast: 5 }),
  },
  IMPLOSION,
  // todo: ruination
  {
    spell: SPELLS.HAND_OF_GULDAN_CAST,
    condition: cnd.describe(
      cnd.or(
        cnd.and(
          cnd.hasResource(RESOURCE_TYPES.SOUL_SHARDS, { atLeast: 3 }),
          cnd.spellCooldownRemaining(SPELLS.SUMMON_DEMONIC_TYRANT, { atLeast: 5000 }),
        ),
        cnd.hasResource(RESOURCE_TYPES.SOUL_SHARDS, { atLeast: 5 }),
      ),
      (tense) => (
        <>
          you {tenseAlt(tense, 'have', 'had')} 3+ Soul Shards and{' '}
          {tenseAlt(tense, "aren't", "weren't")} pooling for{' '}
          <SpellLink spell={SPELLS.SUMMON_DEMONIC_TYRANT} />
        </>
      ),
    ),
  },
  // todo: infernal bolt
  DEMONBOLT_CORE_HOLD,
  DEMONBOLT_CORE,
  SPELLS.SHADOW_BOLT_DEMO,
]);

export const apl = (info: PlayerInfo): Apl =>
  info.combatant.hasTalent(talents.DIABOLIC_RITUAL_TALENT) ? diabolistApl : soulHarvesterApl;

export const check = (events: AnyEvent[], info: PlayerInfo): CheckResult =>
  aplCheck(apl(info))(events, info);

export default suggestion((events, info) => {
  const { violations } = check(events, info);
  annotateTimeline(violations);
  return undefined;
});
