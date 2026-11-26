public union Pet(Cat, Dog);
//     ^ keyword
//           ^ type
//               ^ type
//                    ^ type

partial union Value(int);
partial union Value;
//      ^ keyword
//            ^ type

public closed class GateState { }
//     ^ keyword

class C
{
    static safe extern void F();
    //     ^ keyword

    void M()
    {
        var x = unsafe(F());
        //      ^ keyword
        outer: while (true) { break outer; }
    }
}
