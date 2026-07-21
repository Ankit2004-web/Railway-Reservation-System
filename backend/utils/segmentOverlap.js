/**
 * Segment interval overlap for route-segment seat inventory (Category B).
 * Intervals are half-open: [from, to) using stop sequences.
 */

function intervalsOverlap(aFrom, aTo, bFrom, bTo) {
    return aFrom < bTo && bFrom < aTo;
}

function canAllocateSeat(existingAllocations, fromSeq, toSeq) {
    return !existingAllocations.some((a) =>
        intervalsOverlap(a.fromStopSequence, a.toStopSequence, fromSeq, toSeq)
    );
}

module.exports = { intervalsOverlap, canAllocateSeat };
