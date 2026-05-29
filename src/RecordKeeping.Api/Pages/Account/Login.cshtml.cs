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
public sealed class LoginModel(SignInManager<ApplicationUser> signInManager) : PageModel
{
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

    /// <summary>Renders the login form.</summary>
    public IActionResult OnGet() => Page();

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

        return Redirect(ReturnUrl ?? "/");
    }
}
