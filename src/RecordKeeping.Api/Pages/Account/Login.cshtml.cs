using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using RecordKeeping.Infrastructure.Identity;

namespace RecordKeeping.Api.Pages.Account;

/// <summary>
/// Server-rendered login page used as the redirect target for the
/// OpenIddict Authorization Code flow. Validates credentials via
/// <see cref="SignInManager{TUser}"/> and issues the Identity cookie
/// on success, then redirects back to <see cref="ReturnUrl"/>.
/// </summary>
/// <remarks>
/// When "Remember me" is checked, the submitted credentials are stored in a
/// persistent, http-only cookie so a returning user finds the login form
/// pre-filled. The cookie payload is encrypted with ASP.NET Core Data
/// Protection (<see cref="IDataProtector"/>): the password is never written to
/// the client in plaintext and is not readable by JavaScript. Unchecking the
/// box clears the cookie.
/// </remarks>
public sealed class LoginModel(
    SignInManager<ApplicationUser> signInManager,
    IDataProtectionProvider dataProtectionProvider) : PageModel
{
    // Persistent cookie carrying the encrypted "remember me" credentials.
    private const string RememberedCredentialsCookie = "RecordKeeping.RememberedCredentials";

    // Data Protection purpose string — versioned so the payload format can evolve.
    private const string ProtectorPurpose =
        "RecordKeeping.Api.Pages.Account.Login.RememberedCredentials.v1";

    // How long remembered credentials persist on the client.
    private static readonly TimeSpan RememberDuration = TimeSpan.FromDays(30);

    private readonly IDataProtector _protector =
        dataProtectionProvider.CreateProtector(ProtectorPurpose);

    /// <summary>The user's email address.</summary>
    [BindProperty]
    public string Email { get; set; } = string.Empty;

    /// <summary>The user's password.</summary>
    [BindProperty]
    public string Password { get; set; } = string.Empty;

    /// <summary>The URL to redirect to after successful sign-in (typically the OpenIddict /connect/authorize URL).</summary>
    [BindProperty(SupportsGet = true)]
    public string? ReturnUrl { get; set; }

    /// <summary>When true, the issued Identity cookie persists across browser sessions; otherwise it is session-only.</summary>
    [BindProperty]
    public bool RememberMe { get; set; }

    /// <summary>Renders the login form, pre-filling any remembered credentials.</summary>
    public IActionResult OnGet()
    {
        if (TryReadRememberedCredentials(out var email, out var password))
        {
            Email = email;
            Password = password;
            RememberMe = true;
        }

        return Page();
    }

    /// <summary>Validates credentials and signs the user in.</summary>
    public async Task<IActionResult> OnPostAsync()
    {
        if (!ModelState.IsValid)
        {
            return Page();
        }

        var result = await signInManager.PasswordSignInAsync(
            Email, Password, isPersistent: RememberMe, lockoutOnFailure: false);

        if (!result.Succeeded)
        {
            ModelState.AddModelError(string.Empty, "Invalid credentials.");
            return Page();
        }

        // Honor the checkbox: remember the credentials for next time, or forget them.
        if (RememberMe)
        {
            WriteRememberedCredentials(Email, Password);
        }
        else
        {
            ClearRememberedCredentials();
        }

        return Redirect(ReturnUrl ?? "/");
    }

    private void WriteRememberedCredentials(string email, string password)
    {
        var payload = JsonSerializer.Serialize(new RememberedCredentials(email, password));
        var protectedValue = _protector.Protect(payload);

        Response.Cookies.Append(RememberedCredentialsCookie, protectedValue, CookieOptions());
    }

    private bool TryReadRememberedCredentials(out string email, out string password)
    {
        email = string.Empty;
        password = string.Empty;

        if (!Request.Cookies.TryGetValue(RememberedCredentialsCookie, out var protectedValue)
            || string.IsNullOrEmpty(protectedValue))
        {
            return false;
        }

        try
        {
            var payload = _protector.Unprotect(protectedValue);
            if (JsonSerializer.Deserialize<RememberedCredentials>(payload) is not { } creds)
            {
                return false;
            }

            email = creds.Email;
            password = creds.Password;
            return true;
        }
        catch (Exception ex) when (ex is CryptographicException or JsonException)
        {
            // Tampered, truncated, or encrypted with a retired key — drop the bad cookie.
            ClearRememberedCredentials();
            return false;
        }
    }

    private void ClearRememberedCredentials() =>
        Response.Cookies.Delete(RememberedCredentialsCookie, CookieOptions());

    // Cookie attributes. Secure mirrors the request scheme (SameAsRequest) so the cookie
    // survives the HTTP dev/test server while staying Secure behind TLS in production.
    private CookieOptions CookieOptions() => new()
    {
        HttpOnly = true,
        Secure = Request.IsHttps,
        SameSite = SameSiteMode.Lax,
        IsEssential = true,
        Path = "/",
        MaxAge = RememberDuration,
    };

    // Encrypted-at-rest payload for the "remember me" cookie. Never stored in plaintext.
    private sealed record RememberedCredentials(string Email, string Password);
}
