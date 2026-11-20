namespace Sample;
//        ^ module

class C
{
    int member;
    //  ^ property
    int Prop { get; set; }
    //  ^ property

    void Declared(int param)
    {
        Declared(param);
        // <- function
        //       ^ variable
        this.Declared(param);
        //   ^ function
        member = Prop;
        // <- variable
    }
}
