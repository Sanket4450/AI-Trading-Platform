import type { Strategy } from '@ai-trading/trading-engine';
import {
  ORB_IMPLEMENTATION,
  ORB_IMPLEMENTATION_VERSION,
  ORB_PARAMETER_SCHEMA,
  ORB_STRATEGY_CODE,
} from '@ai-trading/domain';
import { evaluateOrbSession } from './evaluator.js';

export const openingRangeBreakout: Strategy = {
  code: ORB_STRATEGY_CODE,
  implementation: ORB_IMPLEMENTATION,
  version: ORB_IMPLEMENTATION_VERSION,
  parameterSchema: ORB_PARAMETER_SCHEMA,
  evaluate: evaluateOrbSession,
};
