package auction

import (
	"testing"
	"time"
)

func mkOrder(id, owner string, side Side, qty, start, floor uint64, submittedAt time.Time, dur time.Duration) *Order {
	return &Order{
		ID: id, Owner: owner, Pair: "AAA/BBB", Side: side,
		Quantity: qty, StartPrice: start, FloorPrice: floor,
		SubmittedAt: submittedAt, Duration: dur,
	}
}

func TestBook_AddGetLive(t *testing.T) {
	b := NewBook("AAA/BBB")
	now := time.Now()
	o := mkOrder("o1", "alice", Buy, 100, 90, 110, now, time.Minute)

	if err := b.Add(o); err != nil {
		t.Fatalf("Add: %v", err)
	}
	if got := b.Get("o1"); got == nil || got.Remaining != 100 {
		t.Fatalf("Get: expected order with remaining 100, got %+v", got)
	}
	if len(b.Live()) != 1 {
		t.Fatalf("Live: expected 1 order, got %d", len(b.Live()))
	}
}

func TestBook_AddRejectsInvalidOrder(t *testing.T) {
	b := NewBook("AAA/BBB")
	now := time.Now()

	if err := b.Add(mkOrder("o1", "alice", Buy, 0, 90, 110, now, time.Minute)); err != ErrInvalidQuantity {
		t.Fatalf("expected ErrInvalidQuantity, got %v", err)
	}
	if err := b.Add(mkOrder("o2", "alice", "bogus", 100, 90, 110, now, time.Minute)); err != ErrInvalidSide {
		t.Fatalf("expected ErrInvalidSide, got %v", err)
	}
	if err := b.Add(mkOrder("o3", "alice", Buy, 100, 0, 110, now, time.Minute)); err != ErrInvalidPrices {
		t.Fatalf("expected ErrInvalidPrices, got %v", err)
	}
}

func TestBook_RemoveRequiresOwner(t *testing.T) {
	b := NewBook("AAA/BBB")
	now := time.Now()
	_ = b.Add(mkOrder("o1", "alice", Buy, 100, 90, 110, now, time.Minute))

	if _, err := b.Remove("o1", "bob"); err != ErrNotOwner {
		t.Fatalf("expected ErrNotOwner, got %v", err)
	}
	if _, err := b.Remove("o1", "alice"); err != nil {
		t.Fatalf("Remove by owner: %v", err)
	}
	if b.Get("o1") != nil {
		t.Fatal("order should be gone after Remove")
	}
}

func TestBook_RemoveNotFound(t *testing.T) {
	b := NewBook("AAA/BBB")
	if _, err := b.Remove("nope", "alice"); err != ErrOrderNotFound {
		t.Fatalf("expected ErrOrderNotFound, got %v", err)
	}
}

func TestBook_CrossImmediateOverlapAtSubmission(t *testing.T) {
	b := NewBook("AAA/BBB")
	now := time.Now()
	// Both orders start (t=0, most-favorable-to-submitter price) already
	// overlapping — buy's StartPrice 110 already exceeds sell's StartPrice
	// 90, so they cross without needing any decay at all.
	_ = b.Add(mkOrder("buy1", "alice", Buy, 100, 110, 130, now, time.Minute))
	_ = b.Add(mkOrder("sell1", "bob", Sell, 100, 90, 70, now, time.Minute))

	matches := b.Cross(now)
	if len(matches) != 1 {
		t.Fatalf("expected 1 match, got %d: %+v", len(matches), matches)
	}
	m := matches[0]
	if m.Quantity != 100 {
		t.Fatalf("expected full fill of 100, got %d", m.Quantity)
	}
	if b.Get("buy1") != nil || b.Get("sell1") != nil {
		t.Fatal("both orders should be fully filled and removed")
	}
}

func TestBook_CrossUsesEarlierOrdersCurrentPriceAsExecutionPrice(t *testing.T) {
	b := NewBook("AAA/BBB")
	now := time.Now()
	// buy1 submitted first, resting at its current price (80 at t=0).
	_ = b.Add(mkOrder("buy1", "alice", Buy, 100, 80, 120, now, time.Minute))
	// sell1 submitted later, crosses buy1's current price immediately.
	_ = b.Add(mkOrder("sell1", "bob", Sell, 100, 79, 60, now.Add(time.Second), time.Minute))

	matches := b.Cross(now.Add(time.Second))
	if len(matches) != 1 {
		t.Fatalf("expected 1 match, got %d", len(matches))
	}
	if matches[0].Price != 80 {
		t.Fatalf("expected execution at buy1's (earlier order) current price 80, got %d", matches[0].Price)
	}
}

func TestBook_CrossPartialFillLeavesRemainderOnBook(t *testing.T) {
	b := NewBook("AAA/BBB")
	now := time.Now()
	_ = b.Add(mkOrder("buy1", "alice", Buy, 100, 80, 120, now, time.Minute))
	_ = b.Add(mkOrder("sell1", "bob", Sell, 40, 80, 60, now, time.Minute))

	matches := b.Cross(now)
	if len(matches) != 1 || matches[0].Quantity != 40 {
		t.Fatalf("expected one 40-qty match, got %+v", matches)
	}

	remaining := b.Get("buy1")
	if remaining == nil || remaining.Remaining != 60 {
		t.Fatalf("expected buy1 to have 60 remaining, got %+v", remaining)
	}
	if b.Get("sell1") != nil {
		t.Fatal("sell1 should be fully filled and removed")
	}
}

func TestBook_CrossNoMatchWhenPricesDontOverlap(t *testing.T) {
	b := NewBook("AAA/BBB")
	now := time.Now()
	// Buy willing to pay at most 90 right now; sell wants at least 100.
	_ = b.Add(mkOrder("buy1", "alice", Buy, 100, 90, 90, now, time.Minute))
	_ = b.Add(mkOrder("sell1", "bob", Sell, 100, 100, 100, now, time.Minute))

	matches := b.Cross(now)
	if len(matches) != 0 {
		t.Fatalf("expected no matches, got %+v", matches)
	}
	if b.Get("buy1") == nil || b.Get("sell1") == nil {
		t.Fatal("both orders should still be live")
	}
}

func TestBook_CrossConvergesAsPricesDecayOverTime(t *testing.T) {
	b := NewBook("AAA/BBB")
	now := time.Now()
	// Buy: starts at 80, decays up to 120 over 100s.
	// Sell: starts at 120, decays down to 80 over 100s.
	// They meet in the middle around t=50s (both at price 100).
	_ = b.Add(mkOrder("buy1", "alice", Buy, 100, 80, 120, now, 100*time.Second))
	_ = b.Add(mkOrder("sell1", "bob", Sell, 100, 120, 80, now, 100*time.Second))

	if matches := b.Cross(now.Add(10 * time.Second)); len(matches) != 0 {
		t.Fatalf("expected no cross yet at t=10s, got %+v", matches)
	}
	matches := b.Cross(now.Add(60 * time.Second))
	if len(matches) != 1 {
		t.Fatalf("expected a cross by t=60s, got %+v", matches)
	}
}

func TestBook_DropRemovesUnconditionally(t *testing.T) {
	b := NewBook("AAA/BBB")
	now := time.Now()
	_ = b.Add(mkOrder("o1", "alice", Buy, 100, 90, 110, now, time.Minute))

	b.Drop("o1")
	if b.Get("o1") != nil {
		t.Fatal("order should be gone after Drop")
	}
}
