class Queries
{
    void M(int[] numbers, Customer[] customers, Order[] orders)
    {
        var evens = from n in numbers
//                  ^ keyword
//                         ^ keyword
                    where n % 2 == 0
//                  ^ keyword
                    select n;
//                  ^ keyword

        var joined =
            from c in customers
//          ^ keyword
            join o in orders on c.Id equals o.CustomerId into placed
//          ^ keyword
//            ^ keyword
//                           ^ keyword
//                                   ^ keyword
//                                                       ^ keyword
            let total = placed.Sum(p => p.Amount)
//          ^ keyword
//                             ^ function
            orderby total descending, c.Name ascending
//          ^ keyword
//                        ^ keyword
//                                           ^ keyword
            select new { c.Name, total };
//          ^ keyword
//                 ^ keyword

        var grouped =
            from Order o in orders
//               ^ type
            group o by o.CustomerId into byCustomer
//          ^ keyword
//                  ^ keyword
//                                  ^ keyword
            where byCustomer.Count() > 1
//          ^ keyword
            select byCustomer.Key;

        var from = 1;
//          ^ variable
        var let = from + 1;
//          ^ variable
//                ^ variable
        var on = let;
//          ^ variable
        var by = on;
//          ^ variable
        var group = by;
//          ^ variable
        var into = group;
//          ^ variable
    }

    T First<T>(T[] items) where T : class => items[0];
//                        ^ keyword
}
