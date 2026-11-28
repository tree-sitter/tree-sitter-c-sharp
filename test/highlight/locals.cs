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
        //                 ^ variable.parameter
        //                         ^ variable.parameter
        //                                ^ variable.parameter
        return total;
        //     ^ variable
    }

    T Echo<T>(T value) where T : class => value;
    // <- type
    //     ^ type
    //        ^ type
    //          ^ variable.parameter
    //                       ^ type
    //                                    ^ variable.parameter

    void Query(int[] numbers)
    {
        var q = from n in numbers
                let doubled = n * 2
                //  ^ variable
                //            ^ variable
                select doubled into d
                //     ^ variable
                //                  ^ variable
                select d;
                //     ^ variable
    }
}
