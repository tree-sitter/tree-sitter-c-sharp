using System.Text.RegularExpressions;

// Strings that queries/injections.scm hands to another language still
// highlight as C# strings, whether or not that language is installed.

partial class Injections
{
    [GeneratedRegex(@"^\d+$", RegexOptions.IgnoreCase)]
//                  ^ string
    private static partial Regex Digits();

    void M(string input)
    {
        var a = new Regex("^a.c$");
//                        ^ string
        var b = Regex.IsMatch(input, """[a-z]+""");
//                                   ^ string
        var c = Regex.Replace(input, @"\s+", " ");
//                                   ^ string
        // lang=json
//      ^ comment
        var d = """{"a": 1}""";
//              ^ string
        Use(/* lang=regex */ "abc+");
//          ^ comment
//                           ^ string
    }
}
