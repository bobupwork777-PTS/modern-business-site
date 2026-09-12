export default function Footer() {
    return (
        <footer className="bg-[#050816] text-white">

            <div className="max-w-7xl mx-auto px-6 py-16">
                <div className="grid md:grid-cols-4 gap-10">
                    {/* Brand */}
                    <div className="md:col-span-2">
                        <h2 className="text-3xl font-bold">
                            Phoenix<span className="text-blue-400">.</span>
                        </h2>
                        <p className="mt-5 text-gray-400 max-w-md leading-relaxed">
                            Phoenix Consulting helps businesses build modern digital
                            experiences through web development, automation, and
                            technology solutions.
                        </p>
                    </div>

                    {/* Navigation */}
                    <div>
                        <h3 className="text-lg font-semibold mb-5">
                            Explore
                        </h3>
                        <ul className="space-y-3 text-gray-400">
                            <li>
                                <a href="#about" className="hover:text-white transition">
                                    About
                                </a>
                            </li>
                            <li>
                                <a href="#services" className="hover:text-white transition">
                                    Services
                                </a>
                            </li>
                            <li>
                                <a href="#process" className="hover:text-white transition">
                                    Process
                                </a>
                            </li>
                            <li>
                                <a href="#contact" className="hover:text-white transition">
                                    Contact
                                </a>
                            </li>
                        </ul>
                    </div>



                    {/* Contact */}
                    <div>
                        <h3 className="text-lg font-semibold mb-5">
                            Contact
                        </h3>
                        <ul className="space-y-3 text-gray-400">
                            <li>ptsglobals@gmail.com</li>
                            <li>+91 9854 845 875</li>
                            <li>India</li>
                        </ul>
                    </div>
                </div>
                <div className="border-t border-white/10 mt-14 pt-8 flex flex-col md:flex-row justify-between gap-4 text-sm text-gray-500">

                    <p>
                        © {new Date().getFullYear()} Phoenix Consulting. All rights reserved.
                    </p>
                    <div className="flex gap-6">
                        <a href="#" className="hover:text-white">
                            Privacy Policy
                        </a>
                        <a href="#" className="hover:text-white">
                            Terms
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
}