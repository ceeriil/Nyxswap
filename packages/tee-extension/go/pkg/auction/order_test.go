package auction

import (
	"testing"
	"time"
)

func TestOrder_CurrentPrice_Buy_DecaysUpwardFromFavorableStart(t *testing.T) {
	start := time.Now()
	o := &Order{
		Side: Buy, StartPrice: 100, FloorPrice: 200,
		SubmittedAt: start, Duration: 100 * time.Second,
	}

	if got := o.CurrentPrice(start); got != 100 {
		t.Fatalf("at t=0, want 100, got %d", got)
	}
	if got := o.CurrentPrice(start.Add(50 * time.Second)); got != 150 {
		t.Fatalf("at t=50%%, want 150, got %d", got)
	}
	if got := o.CurrentPrice(start.Add(100 * time.Second)); got != 200 {
		t.Fatalf("at t=100%%, want 200 (floor), got %d", got)
	}
}

func TestOrder_CurrentPrice_Sell_DecaysDownwardFromFavorableStart(t *testing.T) {
	start := time.Now()
	o := &Order{
		Side: Sell, StartPrice: 200, FloorPrice: 100,
		SubmittedAt: start, Duration: 100 * time.Second,
	}

	if got := o.CurrentPrice(start); got != 200 {
		t.Fatalf("at t=0, want 200, got %d", got)
	}
	if got := o.CurrentPrice(start.Add(50 * time.Second)); got != 150 {
		t.Fatalf("at t=50%%, want 150, got %d", got)
	}
	if got := o.CurrentPrice(start.Add(100 * time.Second)); got != 100 {
		t.Fatalf("at t=100%%, want 100 (floor), got %d", got)
	}
}

func TestOrder_CurrentPrice_ClampsPastDuration(t *testing.T) {
	start := time.Now()
	o := &Order{
		Side: Buy, StartPrice: 100, FloorPrice: 200,
		SubmittedAt: start, Duration: 10 * time.Second,
	}

	if got := o.CurrentPrice(start.Add(time.Hour)); got != 200 {
		t.Fatalf("long past duration, want floor 200, got %d", got)
	}
}

func TestOrder_CurrentPrice_ClampsBeforeSubmission(t *testing.T) {
	start := time.Now()
	o := &Order{
		Side: Buy, StartPrice: 100, FloorPrice: 200,
		SubmittedAt: start, Duration: 10 * time.Second,
	}

	if got := o.CurrentPrice(start.Add(-time.Second)); got != 100 {
		t.Fatalf("before submission, want start 100, got %d", got)
	}
}

func TestOrder_Expired(t *testing.T) {
	start := time.Now()
	o := &Order{SubmittedAt: start, Duration: 10 * time.Second}

	if o.Expired(start.Add(5 * time.Second)) {
		t.Fatal("should not be expired at 50%% elapsed")
	}
	if !o.Expired(start.Add(10 * time.Second)) {
		t.Fatal("should be expired at exactly Duration elapsed")
	}
	if !o.Expired(start.Add(time.Minute)) {
		t.Fatal("should be expired well past Duration")
	}
}
