const steps = [
    "Discover",
    "Design",
    "Develop",
    "Launch"
];


export default function Process() {

    return (

        <section id="process" className="py-24 bg-[#050816] text-white overflow-hidden">

            <div className="max-w-7xl mx-auto px-6">


                <p className="text-center text-blue-400 uppercase tracking-widest text-sm">
                    How We Work
                </p>


                <h2 className="text-4xl font-bold text-center mt-3">
                    Our Process
                </h2>



                <div className="grid md:grid-cols-4 gap-8 mt-12">


                    {steps.map((step, index) => (

                        <div
                            key={step}
                            className="
group
relative
rounded-3xl
border
border-white/10
bg-white/5
backdrop-blur-xl
p-8
overflow-hidden
hover:-translate-y-3
transition-all
duration-500
"
                        >


                            {/* Glow */}

                            <div className="
absolute
-top-10
-right-10
w-32
h-32
bg-blue-500/20
blur-3xl
rounded-full
group-hover:bg-purple-500/30
transition
"/>



                            {/* Number */}

                            <div className="
relative
w-16
h-16
rounded-2xl
border
border-blue-400/30
bg-blue-500/10
flex
items-center
justify-center
text-blue-400
text-3xl
font-bold
group-hover:scale-110
transition
">

                                0{index + 1}

                            </div>




                            <h3 className="
mt-6
text-xl
font-semibold
">

                                {step}

                            </h3>



                            <p className="
mt-3
text-gray-400
text-sm
leading-relaxed
">

                                We analyze requirements, create strategies,
                                build solutions and deliver scalable results.

                            </p>



                            <div className="
mt-6
h-1
w-0
bg-gradient-to-r
from-blue-400
to-purple-500
rounded-full
group-hover:w-full
transition-all
duration-700
"/>



                        </div>


                    ))}


                </div>


            </div>


        </section>

    )

}