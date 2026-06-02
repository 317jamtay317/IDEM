namespace RecordKeeping.Domain.Common;

/// <summary>
/// Base type for aggregate roots — the entry point to an aggregate and the only member of it
/// that outside code may reference or load. The root guards the aggregate's invariants and is
/// the unit of persistence: there is exactly one repository per aggregate root. Roots record
/// <see cref="DomainEvents"/> that describe significant changes for later dispatch.
/// </summary>
/// <typeparam name="TId">The type of the aggregate root's identifier.</typeparam>
/// <param name="id">The aggregate root's unique identifier.</param>
public abstract class AggregateRoot<TId>(TId id) : Entity<TId>(id)
    where TId : notnull
{
    private readonly List<IDomainEvent> _domainEvents = [];

    /// <summary>
    /// The domain events this aggregate has raised but that have not yet been dispatched.
    /// </summary>
    public IReadOnlyCollection<IDomainEvent> DomainEvents => _domainEvents;

    /// <summary>Records a domain event to be dispatched once the aggregate is persisted.</summary>
    /// <param name="domainEvent">The event to raise.</param>
    protected void RaiseDomainEvent(IDomainEvent domainEvent) => _domainEvents.Add(domainEvent);

    /// <summary>Clears the recorded domain events; called after they have been dispatched.</summary>
    public void ClearDomainEvents() => _domainEvents.Clear();
}
