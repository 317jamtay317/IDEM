using ErrorOr;

namespace RecordKeeping.Api.Endpoints;

/// <summary>
/// Maps <see cref="ErrorOr{T}"/> results onto HTTP <see cref="IResult"/> responses.
/// </summary>
public static class ErrorOrResults
{
    /// <summary>
    /// Returns <paramref name="onValue"/> applied to the success value, or a
    /// problem response derived from the first error.
    /// </summary>
    /// <typeparam name="T">The success value type.</typeparam>
    /// <param name="result">The result to translate.</param>
    /// <param name="onValue">Projection invoked when <paramref name="result"/> is a success.</param>
    /// <returns>The success result or a mapped error response.</returns>
    public static IResult Match<T>(this ErrorOr<T> result, Func<T, IResult> onValue) =>
        result.IsError ? Problem(result.Errors) : onValue(result.Value);

    /// <summary>Maps a list of <see cref="Error"/> to a problem response by its first error.</summary>
    /// <param name="errors">The errors to map.</param>
    /// <returns>An <see cref="IResult"/> with an appropriate status code.</returns>
    public static IResult Problem(List<Error> errors)
    {
        var error = errors[0];
        var statusCode = error.Type switch
        {
            ErrorType.Validation => StatusCodes.Status400BadRequest,
            ErrorType.NotFound => StatusCodes.Status404NotFound,
            ErrorType.Conflict => StatusCodes.Status409Conflict,
            ErrorType.Unauthorized => StatusCodes.Status401Unauthorized,
            ErrorType.Forbidden => StatusCodes.Status403Forbidden,
            _ => StatusCodes.Status500InternalServerError,
        };

        return Results.Problem(
            statusCode: statusCode,
            title: error.Code,
            detail: error.Description);
    }
}
