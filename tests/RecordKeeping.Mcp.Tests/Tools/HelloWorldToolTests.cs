using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using RecordKeeping.Mcp.Tools;
using Shouldly;

namespace RecordKeeping.Mcp.Tests.Tools;

/// <summary>
/// Unit tests for <see cref="HelloWorldTool"/>. The end-to-end authenticated transport is
/// proven by the integration tests; these cover the greeting logic in isolation.
/// </summary>
public class HelloWorldToolTests
{
    [Fact]
    public void HelloWorld_WhenCallerHasNameClaim_GreetsThatCallerByName()
    {
        var tool = new HelloWorldTool(AccessorFor(new Claim("name", "Ada Lovelace")));

        var greeting = tool.HelloWorld();

        greeting.ShouldContain("Ada Lovelace");
    }

    [Fact]
    public void HelloWorld_WhenNoAuthenticatedContext_StillGreets()
    {
        // A null HttpContext (no ambient request) must not throw — the tool degrades gracefully.
        var tool = new HelloWorldTool(new HttpContextAccessor());

        var greeting = tool.HelloWorld();

        greeting.ShouldNotBeNullOrWhiteSpace();
    }

    [Fact]
    public void HelloWorld_AlwaysIdentifiesRecordKeeping()
    {
        var tool = new HelloWorldTool(AccessorFor(new Claim("name", "Grace Hopper")));

        var greeting = tool.HelloWorld();

        greeting.ShouldContain("RecordKeeping");
    }

    private static IHttpContextAccessor AccessorFor(params Claim[] claims)
    {
        var context = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(
                new ClaimsIdentity(claims, authenticationType: "Test", nameType: "name", roleType: "role")),
        };
        return new HttpContextAccessor { HttpContext = context };
    }
}
