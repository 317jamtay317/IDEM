using RecordKeeping.Domain.Common;
using Shouldly;

namespace RecordKeeping.Domain.Tests.Common;

public class AggregateRootTests
{
    [Fact]
    public void NewAggregate_HasNoDomainEvents()
    {
        var cart = new Cart(Guid.NewGuid());

        cart.DomainEvents.ShouldBeEmpty();
    }

    [Fact]
    public void RaiseDomainEvent_RecordsTheEvent()
    {
        var cart = new Cart(Guid.NewGuid());

        cart.CheckOut();

        cart.DomainEvents.ShouldHaveSingleItem().ShouldBeOfType<CheckedOut>();
    }

    [Fact]
    public void ClearDomainEvents_RemovesAllEvents()
    {
        var cart = new Cart(Guid.NewGuid());
        cart.CheckOut();

        cart.ClearDomainEvents();

        cart.DomainEvents.ShouldBeEmpty();
    }

    // Test doubles — a concrete aggregate root and the event it raises.
    private sealed class Cart(Guid id) : AggregateRoot<Guid>(id)
    {
        public void CheckOut() => RaiseDomainEvent(new CheckedOut(Id));
    }

    private sealed record CheckedOut(Guid CartId) : IDomainEvent;
}
