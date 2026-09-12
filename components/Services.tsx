const services = [
    "Website Design",
    "React & Next.js Development",
    "Automation Solutions",
    "UI/UX Design"
];


export default function Services() {

    return (

        <section id="services" className="py-24 bg-gray-50 overflow-hidden">

            <div className="max-w-7xl mx-auto px-6">


                <p className="text-center text-blue-600 uppercase tracking-widest text-sm">
                    What We Do
                </p>


                <h2 className="text-4xl font-bold text-center mt-3 text-gray-900">
                    Our Services
                </h2>



                <div className="grid md:grid-cols-4 gap-6 mt-12">


                    {services.map((service, index) => (

                        <div
                            key={service}
                            className="
group
relative
bg-white
rounded-3xl
p-8
border
border-gray-100
shadow-sm
hover:shadow-xl
transition
overflow-hidden
"
                        >


                            {/* Glow */}

                            <div className="
absolute
top-0
right-0
w-24
h-24
bg-blue-500/10
rounded-full
blur-2xl
group-hover:bg-blue-500/20
transition
"/>



                            {/* Icon */}

                            <div className="
w-14
h-14
rounded-2xl
bg-blue-50
flex
items-center
justify-center
text-2xl
text-blue-600
group-hover:scale-110
transition
">

                                {["🌐", "⚡", "🤖", "🎨"][index]}

                            </div>




                            <h3 className="
mt-6
font-bold
text-xl
text-gray-900
">

                                {service}

                            </h3>



                            <p className="
mt-4
text-gray-600
leading-relaxed
">

                                Modern solutions designed for business growth with
                                scalable technology and creative strategies.

                            </p>




                            <div className="
mt-6
h-1
w-0
bg-blue-600
rounded-full
group-hover:w-full
transition-all
duration-500
"/>



                        </div>


                    ))}


                </div>


            </div>


        </section>

    )

}