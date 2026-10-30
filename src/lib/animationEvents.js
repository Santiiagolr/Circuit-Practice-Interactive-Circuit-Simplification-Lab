/** Build UI-only feedback from one accepted business-state transition. */
export function describeAnimationTransition(previous, action, next, id) {
  if (!previous || !next || previous === next) return null;

  if (['reduce', 'answer'].includes(action.type)) {
    const beforeExercise = previous.current.exercise;
    const afterExercise = next.current.exercise;
    const attempt = next.current.attempts.at(-1);
    if (attempt?.kind !== 'reduction' || afterExercise.id !== beforeExercise.id || afterExercise.revision !== beforeExercise.revision + 1) return null;
    const afterIds = new Set(afterExercise.edges.map(edge => edge.id));
    const equivalent = attempt.equivalent && afterExercise.edges.find(edge => edge.label === attempt.equivalent.label);
    return {
      id,
      type: 'reduction',
      exerciseId: beforeExercise.id,
      rule: attempt.rule,
      beforeExercise,
      afterExercise,
      removedIds: beforeExercise.edges.filter(edge => !afterIds.has(edge.id)).map(edge => edge.id),
      equivalentId: equivalent?.id ?? null,
      stepPoints: Math.max(0, next.current.earnedStepPoints - (previous.current.earnedStepPoints || 0)),
      scoreBefore: previous.progress.score,
      scoreAfter: next.progress.score,
      stepStreakBefore: previous.progress.stepStreak,
      stepStreakAfter: next.progress.stepStreak,
      bestStepStreak: next.progress.bestStepStreak,
    };
  }

  if (action.type === 'submit') {
    const item = next.history.at(-1);
    if (previous.current.submitted || item?.id !== previous.current.exercise.id || item.status !== 'complete') return null;
    return {
      id,
      type: 'completion',
      source: previous.settings.mode === 'exam' ? 'exam' : 'workbench',
      exerciseId: previous.current.exercise.id,
      exercise: item.final,
      settings: item.settings,
      equivalent: item.final?.edges?.length === 1 ? item.final.edges[0].value : null,
      errors: item.errors,
      repeat: item.repeat === true,
      stepPoints: item.stepPoints || 0,
      rewardPoints: item.reward?.points || 0,
      totalPoints: (item.stepPoints || 0) + (item.reward?.points || 0),
      streak: next.progress.streak,
      stepStreak: next.progress.stepStreak,
    };
  }

  return null;
}
