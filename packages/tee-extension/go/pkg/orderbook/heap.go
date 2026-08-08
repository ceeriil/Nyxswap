package orderbook

import "container/heap"

// heapEntry wraps an *Order with its current position in the heap array, so
// a specific order can be removed in O(log n) by ID (needed for
// CancelOrder) rather than only supporting "pop the best".
type heapEntry struct {
	order *Order
	index int
}

// priceTimeHeap is a container/heap.Interface ordering entries by price
// (better first — direction set by `better`), then by timestamp (earlier
// first) as the tiebreaker. That ordering *is* price-time priority.
type priceTimeHeap struct {
	entries []*heapEntry
	better  func(a, b uint64) bool
}

func (h priceTimeHeap) Len() int { return len(h.entries) }

func (h priceTimeHeap) Less(i, j int) bool {
	a, b := h.entries[i].order, h.entries[j].order
	if a.Price != b.Price {
		return h.better(a.Price, b.Price)
	}
	return a.Timestamp < b.Timestamp
}

func (h priceTimeHeap) Swap(i, j int) {
	h.entries[i], h.entries[j] = h.entries[j], h.entries[i]
	h.entries[i].index = i
	h.entries[j].index = j
}

func (h *priceTimeHeap) Push(x any) {
	e := x.(*heapEntry) //nolint:errcheck // container/heap.Interface requires this signature
	e.index = len(h.entries)
	h.entries = append(h.entries, e)
}

func (h *priceTimeHeap) Pop() any {
	old := h.entries
	n := len(old)
	e := old[n-1]
	old[n-1] = nil
	h.entries = old[:n-1]
	return e
}

// orderSide holds one side of the book (bids or asks) as a price-time heap
// plus an ID index for O(log n) lookup/removal by order ID.
type orderSide struct {
	h    *priceTimeHeap
	byID map[string]*heapEntry
}

// newOrderSide creates an orderSide. descending=true for bids (highest price
// wins), false for asks (lowest price wins).
func newOrderSide(descending bool) *orderSide {
	var better func(a, b uint64) bool
	if descending {
		better = func(a, b uint64) bool { return a > b }
	} else {
		better = func(a, b uint64) bool { return a < b }
	}
	h := &priceTimeHeap{better: better}
	heap.Init(h)
	return &orderSide{h: h, byID: make(map[string]*heapEntry)}
}

func (s *orderSide) Add(order *Order) {
	e := &heapEntry{order: order}
	heap.Push(s.h, e)
	s.byID[order.ID] = e
}

// Remove removes and returns the order with the given ID, or nil if absent.
func (s *orderSide) Remove(orderID string) *Order {
	e, ok := s.byID[orderID]
	if !ok {
		return nil
	}
	heap.Remove(s.h, e.index)
	delete(s.byID, orderID)
	return e.order
}

// Best returns the best-priced resting order without removing it, or nil if
// the side is empty.
func (s *orderSide) Best() *Order {
	if s.h.Len() == 0 {
		return nil
	}
	return s.h.entries[0].order
}

// dropBest removes the current best (root) order — called immediately after
// it's been fully filled by a match. Must only be called when the caller
// knows the order it just filled is still the root (true whenever it was
// obtained via Best() with no intervening heap mutation).
func (s *orderSide) dropBest() {
	if s.h.Len() == 0 {
		return
	}
	e := s.h.entries[0]
	heap.Remove(s.h, 0)
	delete(s.byID, e.order.ID)
}

func (s *orderSide) Has(orderID string) bool {
	_, ok := s.byID[orderID]
	return ok
}

func (s *orderSide) GetOrder(orderID string) *Order {
	e, ok := s.byID[orderID]
	if !ok {
		return nil
	}
	return e.order
}

func (s *orderSide) Len() int { return s.h.Len() }
