class X
{
    class var
    //     ^ type
    {
        void M()
        {
            var var = new var();
            // <- type
            //   ^ variable
        }
    }
}

class Y
{
    void M()
    {
        var var = new Y();
        // <- type
        //   ^ variable
    }
}
