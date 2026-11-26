/// <summary>
// <- comment.documentation
///   Says <c>hi</c>.
//         ^ comment.documentation
/// </summary>
//// Four slashes: an ordinary comment.
// <- comment
class Docs
{
    /// <param name="x">The value.</param>
    // <- comment.documentation
    ///<returns>The same value.</returns>
    //  ^ comment.documentation
    int M(int x) => x;
    // <- type.builtin
}
