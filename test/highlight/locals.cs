class Locals
{
    int M(int count, string name)
    //        ^ variable.parameter
    {
        var total = count + 1;
        //          ^ variable.parameter
        //  ^ variable
        Use(name);
        //  ^ variable.parameter
        Func<int, int> f = item => item * count;
        //                                ^ variable.parameter
        return total;
        //     ^ variable
    }
}
