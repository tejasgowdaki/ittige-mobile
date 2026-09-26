type ActionAllocation = {
  id: string;
  stockLocationId: string | null;
  qtyAllocated: string | number;
};

type ActionTransferLine = {
  materialId: string;
  qtySent: string | number;
  requestAllocationId: string | null;
};

type ActionTransfer = {
  status: string;
  fromLocationId: string | null;
  lines: ActionTransferLine[];
};

type ActionRequest = {
  status: string;
  requestedBy: { id: string };
  lines: { materialId: string; allocations: ActionAllocation[] }[];
  transfers: ActionTransfer[];
};

function qty(value: string | number | null | undefined) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

export function sentFromSource(
  request: { transfers: ActionTransfer[] },
  materialId: string,
  allocation: { id: string; stockLocationId: string | null },
) {
  return (request.transfers ?? [])
    .filter((transfer) => transfer.status !== "CANCELLED" && transfer.status !== "REJECTED")
    .reduce((sum, transfer) => {
      const line = transfer.lines.find((item) =>
        item.requestAllocationId
          ? item.requestAllocationId === allocation.id && item.materialId === materialId
          : item.materialId === materialId && transfer.fromLocationId === allocation.stockLocationId,
      );
      return sum + qty(line?.qtySent);
    }, 0);
}

export function actionableCounts(requests: ActionRequest[], myId: string, canTransfer: boolean) {
  let approval = 0;
  let planning = 0;
  for (const request of requests) {
    if (request.status === "SUBMITTED" && canTransfer && request.requestedBy.id !== myId) {
      approval += request.lines.length;
    }
    if (canTransfer && (request.status === "APPROVED" || request.status === "PARTIALLY_FULFILLED")) {
      for (const line of request.lines) {
        for (const allocation of line.allocations) {
          const left = qty(allocation.qtyAllocated) - sentFromSource(request, line.materialId, allocation);
          if (left > 0.0000001) planning += 1;
        }
      }
    }
    if (request.requestedBy.id === myId) {
      for (const transfer of request.transfers ?? []) {
        if (transfer.status === "DISPATCHED") planning += transfer.lines.length;
      }
    }
  }
  return { requests: approval, planning };
}
