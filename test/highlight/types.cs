class A
{
    public void M()
    {
        int a;
        // <- type.builtin
        var a;
        // <- type.builtin

        int? a;
        // <- type.builtin
        // ^ operator
        A? a;
        // <- type
         // <- operator

        int* a;
        // <- type.builtin
        // ^ operator
        A* a;
        // <- type
         // <- operator

        ref A* a;
        // <- keyword
        //  ^ type
        //   ^ operator

        var a = x is int;
        //           ^ type.builtin
        var a = x is A;
        //           ^

        var a = x as int;
        //           ^ type.builtin
        var a = x as A;
        //           ^ type

        var a = (int)x;
        //       ^ type.builtin
        var a = (A)x;
        //       ^ type
    }

}