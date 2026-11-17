public union Pet(Cat, Dog);
//     ^ keyword
//           ^ type
//               ^ type
//                    ^ type

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
