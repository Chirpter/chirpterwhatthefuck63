# AI Error Patterns to Watch For

A concise list of recurring, systemic errors made by the AI.

---

### 1. Incorrect Template Literal Syntax

*   **Symptom:** The AI consistently generates invalid syntax for dynamic strings.
*   **Incorrect Code:** `'a_string_with_${'${a_variable}'}'`
*   **Correct Code:** `` `a_string_with_${a_variable}` ``
*   **Impact:** Causes logic failures as variables are not interpolated correctly.

---

### 2. Missing `await` for `cookies()` in Middleware

*   **Symptom:** In `src/middleware.ts` (Next.js 15+), the AI fails to `await` the `cookies()` function.
*   **Incorrect Code:** `const cookieStore = cookies();`
*   **Correct Code:** `const cookieStore = await cookies();`
*   **Impact:** Breaks authentication logic by treating a Promise as the cookie store object.