#define TRACE_ALL
// <- keyword
 // <- keyword
//      ^ constant
#undef LEGACY
 // <- keyword
//     ^ constant

#nullable enable
 // <- keyword
//        ^ keyword
#nullable disable annotations
//        ^ keyword
//                ^ keyword
#nullable restore warnings
//        ^ keyword
//                ^ keyword

#pragma warning disable CS0168, 414
 // <- keyword
//      ^ keyword
//              ^ keyword
//                      ^ constant
//                            ^ punctuation.delimiter
//                              ^ number
#pragma warning restore CS0168
//              ^ keyword
//                      ^ constant
#pragma checksum "Page.cs" "{406EA660-64CF-4C82-B6F0-42D48172A799}" "ab007f1d23d9"
//      ^ keyword
//               ^ string
//                         ^ string
//                                                                  ^ string
#pragma optimize off
 // <- keyword
//      ^ comment

#if DEBUG
// <- keyword
 // <- keyword
//  ^ constant
#warning Debug build: logging is verbose
 // <- keyword
//       ^ string
#elif RELEASE
// <- comment
//    ^ comment
#error Release builds are not supported here
// <- comment
#else
// <- comment
using System.Diagnostics;
// <- comment
#endif
// <- keyword
 // <- keyword

#if !RELEASE && !(CI || TRACE_ALL)
//  ^ operator
//   ^ constant
//           ^ operator
//               ^ punctuation.bracket
//                ^ constant
//                   ^ operator
//                      ^ constant
#error Pick a build configuration
 // <- keyword
//     ^ string
#endif

#if NET8_0 == true || NET9_0 != false
//  ^ constant
//         ^ operator
//            ^ constant.builtin
//                    ^ constant
//                           ^ operator
//                              ^ constant.builtin
#endif

namespace Samples;

#region Shapes
 // <- keyword
//      ^ comment

enum Shape
{
    Circle,
    Square,
#if EXTENDED_SHAPES
//  ^ constant
    Hexagon
//  ^ property.definition
#endif
}

#endregion Shapes
 // <- keyword
//         ^ comment

#if NETFRAMEWORK
//  ^ constant
[Serializable]
 // <- attribute
#endif
class Renderer
{
    #region Fields
//  ^ keyword
//   ^ keyword
//          ^ comment

    object[] handlers = { Draw, Fill,
#if GPU
//  ^ constant
        Shade,
//      ^ variable
#endif
    };

    object[] sizes = [
        1, 2,
#if !SMALL
//   ^ constant
        4,
//      ^ number
#else
// <- comment
        3,
//      ^ comment
#endif
    ];

    #endregion
//   ^ keyword

#if NET5_0_OR_GREATER
//  ^ constant
    [SkipLocalsInit]
//   ^ attribute
#else
    [Pure]
//   ^ comment
#endif
    int Area(int w, int h)
#if CHECKED
//  ^ constant
        => checked(w * h);
//         ^ keyword
#else
        { return w * h; }
//        ^ comment
#endif

    Task<int> ReadAsync(TextReader reader, CancellationToken ct)
    {
        return ct.IsCancellationRequested ? FromCanceled<int>(ct) :
#if NET6_0_OR_GREATER
//  ^ constant
            reader.ReadAsync(buffer, ct).AsTask();
//                                       ^ function
#else
            reader.ReadAsync(buffer);
//                 ^ comment
#endif
    }

    void Draw(object arg, bool ready)
    {
#if TRACE_ALL
        Trace.WriteLine("drawing");
//            ^ function
//                      ^ string
#elif VERBOSE
// <- comment
//    ^ comment
        Console.WriteLine("drawing");
//              ^ comment
#endif

#line 200 "Generated.cs"
// <- keyword
 // <- keyword
//    ^ number
//        ^ string
        int generated = 0;
#line hidden
//    ^ keyword
        generated++;
#line default
//    ^ keyword
#line (1, 1) - (1, 30) 5 "Partial.razor"
//    ^ punctuation.bracket
//     ^ number
//           ^ operator
//                 ^ number
//                     ^ number
//                       ^ string
        generated--;
  # line default
//^ keyword
//  ^ keyword
    }
}

#nullable restore
 // <- keyword
//        ^ keyword
