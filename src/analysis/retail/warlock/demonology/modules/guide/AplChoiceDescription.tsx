import { SubSection, useEvents, useInfo } from 'interface/guide';
import { AplSectionData } from 'interface/guide/components/Apl';
import * as AplCheck from '../features/AplCheck';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';
import {
  defaultExplainers,
  type AplViolationExplainers,
} from 'interface/guide/components/Apl/violations/claims';
import type { Violation } from 'parser/shared/metrics/apl';
import * as cnd from 'parser/shared/metrics/apl/conditions';

const shardTracker = cnd.hasResource(RESOURCE_TYPES.SOUL_SHARDS, {});

function ShardCount({ cast }: { cast: Violation['actualCast'] }) {
  const events = useEvents();
  const info = useInfo();
  if (!info) {
    return null;
  }

  let shards = cast.classResources?.find((r) => r.type === RESOURCE_TYPES.SOUL_SHARDS.id)?.amount;
  if (shards === undefined) {
    let state = shardTracker.init(info);
    for (const event of events) {
      if (event === cast) {
        break;
      }
      state = shardTracker.update(state, event);
    }
    shards = state.current;
  }

  return <p>You had {shards} Soul Shards</p>;
}

// adds the shard count at the time of the cast to every example
const explainers: AplViolationExplainers = Object.fromEntries(
  Object.entries(defaultExplainers).map(([key, explainer]) => [
    key,
    {
      ...explainer,
      describe: (props) => (
        <>
          {explainer.describe(props)}
          <ShardCount cast={props.violation.actualCast} />
        </>
      ),
    },
  ]),
);

export default function AplChoiceDescription() {
  const info = useInfo();
  if (!info) {
    return null;
  }

  return (
    <>
      <p>{/* rotation explanation */}</p>
      <SubSection>
        <AplSectionData
          checker={AplCheck.check}
          apl={AplCheck.apl(info)}
          violationExplainers={explainers}
        />
      </SubSection>
    </>
  );
}
