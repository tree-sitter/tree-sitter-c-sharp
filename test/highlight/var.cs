class X
{
    class var
    //     ^ type
    {
        void M()
        {
            var var = new var();
            // <- type.builtin
            //   ^ variable
        }
    }
}

class Y
{
    void M()
    {
        var var = new Y();
        // <- type.builtin
        //   ^ variable
        Y var = new Y();
        // <- type
    }
}
