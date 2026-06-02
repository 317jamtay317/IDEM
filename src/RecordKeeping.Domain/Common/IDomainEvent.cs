namespace RecordKeeping.Domain.Common;

/// <summary>
/// Marker for a domain event — something significant that has happened in the domain,
/// named in the past tense (e.g. <c>FacilityAdded</c>). Raised by an
/// <see cref="AggregateRoot{TId}"/> and dispatched after the aggregate is persisted, so
/// other parts of the system can react without the aggregate depending on them.
/// </summary>
public interface IDomainEvent;
