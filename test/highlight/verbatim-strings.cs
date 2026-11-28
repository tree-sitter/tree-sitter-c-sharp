class Verbatim
{
    string a = @"C:\temp\";
    //         ^ string
    //            ^ string
    string b = @"say ""hi""";
    //               ^ string.escape
    //                 ^ string
    //                   ^ string.escape
}
