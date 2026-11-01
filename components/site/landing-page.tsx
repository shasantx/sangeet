"use client";

import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowDown, ArrowRight, Download, Headphones, Music2 } from "lucide-react";
import { useRef } from "react";
import { SangeetMark } from "@/components/brand/sangeet-mark";

const APK_URL = "https://github.com/shasantx/sangeet/releases/latest/download/sangeet-android.apk";

export function LandingPage() {
  const hero = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: hero, offset: ["start start", "end start"] });
  const imageY = useTransform(scrollYProgress, [0, 1], [0, 110]);
  const copyY = useTransform(scrollYProgress, [0, 1], [0, 46]);
  const imageOpacity = useTransform(scrollYProgress, [0, 0.85], [1, 0.24]);

  return (
    <main className="min-h-dvh overflow-hidden bg-[#090b09] text-white selection:bg-[#1ed760]/35">
      <section ref={hero} className="relative isolate flex min-h-[min(900px,100svh)] flex-col overflow-hidden">
        <motion.div aria-hidden="true" style={reduceMotion ? undefined : { y: imageY, opacity: imageOpacity }} className="absolute inset-0 -z-30 scale-[1.08] bg-[url('https://images.unsplash.com/photo-1658227633934-b589ca17d602?auto=format&fit=crop&w=2200&q=85')] bg-cover bg-[center_44%]" />
        <div aria-hidden="true" className="absolute inset-0 -z-20 bg-[linear-gradient(90deg,rgba(5,8,6,.94)_0%,rgba(5,8,6,.76)_38%,rgba(5,8,6,.24)_75%,rgba(5,8,6,.25)_100%),linear-gradient(0deg,#090b09_0%,rgba(9,11,9,.04)_46%,rgba(9,11,9,.45)_100%)]" />
        <div aria-hidden="true" className="absolute -right-36 top-14 -z-10 h-[480px] w-[480px] rounded-full bg-emerald-500/20 blur-[130px]" />

        <nav className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-5 py-5 sm:px-8 lg:px-12 lg:py-7" aria-label="Main navigation">
          <Link href="/" className="flex items-center gap-2.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Sangeet home">
            <SangeetMark size={38} />
            <span className="font-display text-[19px] font-semibold tracking-[-.035em]">Sangeet</span>
          </Link>
          <div className="hidden items-center gap-8 text-[13px] font-medium text-white/75 md:flex">
            <a href="#about" className="transition hover:text-white">About</a>
            <a href={APK_URL} className="transition hover:text-white">Android app</a>
            <Link href="https://github.com/shasantx/sangeet" className="transition hover:text-white">Open source</Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/auth" className="hidden h-10 items-center rounded-full px-4 text-[13px] font-semibold text-white/80 transition hover:bg-white/10 hover:text-white sm:inline-flex">Sign in</Link>
            <Link href="/home" className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-[12px] font-bold text-[#101310] transition hover:scale-[1.02] hover:bg-[#e7efe9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:px-5 sm:text-[13px]">Open Sangeet <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
        </nav>

        <div className="mx-auto flex w-full max-w-[1440px] flex-1 items-center px-5 pb-20 pt-14 sm:px-8 sm:pb-24 lg:px-12 lg:pt-20">
          <motion.div initial={reduceMotion ? false : { opacity: 0, y: 20, filter: "blur(10px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }} style={reduceMotion ? undefined : { y: copyY }} className="max-w-[730px]">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/20 px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[.18em] text-white/75 backdrop-blur-xl sm:text-[11px]"><Music2 className="h-3.5 w-3.5 text-primary" /> Music, with room for every sound</div>
            <h1 className="max-w-[690px] font-display text-[clamp(3.15rem,8.5vw,7rem)] font-semibold leading-[.94] tracking-[-.075em] text-white">Your music.<br/><span className="text-white/65">Your place.</span></h1>
            <p className="mt-6 max-w-[480px] text-[15px] leading-7 text-white/75 sm:mt-7 sm:text-[17px] sm:leading-8">Nepali and Hindi music at the heart of it. Every artist, every mood, every language welcome.</p>
            <div className="mt-8 flex flex-col gap-3 sm:mt-9 sm:flex-row sm:items-center">
              <Link href="/auth" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-[13px] font-bold text-primary-foreground shadow-[0_10px_35px_rgba(30,215,96,.2)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><Headphones className="h-4 w-4"/> Start listening <ArrowRight className="h-4 w-4"/></Link>
              <a href={APK_URL} className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/20 bg-black/20 px-6 text-[13px] font-semibold text-white backdrop-blur-md transition hover:border-white/40 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Download className="h-4 w-4"/> Get the Android app</a>
            </div>
            <p className="mt-4 text-[11px] text-white/50">Sign in once · Keep listening across your devices</p>
          </motion.div>
        </div>

        <a href="#about" aria-label="Scroll to learn about Sangeet" className="absolute bottom-7 left-1/2 hidden -translate-x-1/2 items-center gap-2 text-[10px] uppercase tracking-[.18em] text-white/55 transition hover:text-white md:flex">Explore Sangeet <ArrowDown className="h-3.5 w-3.5 animate-bounce"/></a>
        <div aria-hidden="true" className="absolute bottom-0 left-0 right-0 -z-10 h-28 bg-gradient-to-t from-[#090b09] to-transparent" />
      </section>

      <section id="about" className="relative mx-auto grid max-w-[1440px] gap-8 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[.78fr_1.22fr] lg:items-center lg:gap-20 lg:px-12 lg:py-36">
        <div className="pointer-events-none absolute -left-36 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-emerald-500/[.11] blur-[110px]" />
        <motion.div initial={reduceMotion ? false : { opacity: 0, y: 20, filter: "blur(8px)" }} whileInView={reduceMotion ? undefined : { opacity: 1, y: 0, filter: "blur(0px)" }} viewport={{ once: true, amount: 0.4 }} transition={{ duration: 0.65, ease: [0.2, 0.8, 0.2, 1] }} className="relative">
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-[.2em] text-primary">A listening space made for you</p>
          <h2 className="max-w-[510px] font-display text-[clamp(2.3rem,5vw,4.2rem)] font-semibold leading-[1.02] tracking-[-.06em]">From Kathmandu to everywhere.</h2>
        </motion.div>
        <motion.div initial={reduceMotion ? false : { opacity: 0, y: 20, filter: "blur(8px)" }} whileInView={reduceMotion ? undefined : { opacity: 1, y: 0, filter: "blur(0px)" }} viewport={{ once: true, amount: 0.35 }} transition={{ duration: 0.7, delay: 0.08, ease: [0.2, 0.8, 0.2, 1] }} className="relative max-w-[580px] lg:justify-self-end">
          <p className="text-[16px] leading-8 text-white/65 sm:text-[18px]">Find the sounds you grew up with and the artists you haven’t met yet. Take Sangeet with you on the web or Android, and keep your listening close wherever the day goes.</p>
          <div className="mt-7 flex flex-wrap gap-2.5 text-[11px] font-medium text-white/70"><span className="rounded-full border border-white/10 bg-white/[.035] px-3.5 py-2">Nepali</span><span className="rounded-full border border-white/10 bg-white/[.035] px-3.5 py-2">Hindi</span><span className="rounded-full border border-white/10 bg-white/[.035] px-3.5 py-2">And every sound you love</span></div>
          <a href={APK_URL} className="mt-8 inline-flex items-center gap-2 text-[13px] font-semibold text-primary transition hover:text-white">Download for Android <ArrowRight className="h-4 w-4"/></a>
        </motion.div>
      </section>

      <footer className="border-t border-white/[.08] bg-[#070907]">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-8 px-5 py-10 sm:px-8 md:flex-row md:items-end md:justify-between lg:px-12">
          <div><Link href="/" className="inline-flex items-center gap-2"><SangeetMark size={30}/><span className="font-display text-[16px] font-semibold">Sangeet</span></Link><p className="mt-3 text-xs text-white/45">A little more close to home. A little more open to the world.</p></div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-[11px] text-white/55"><a href={APK_URL} className="transition hover:text-white">Android app</a><Link href="/home" className="transition hover:text-white">Listen on web</Link><Link href="https://github.com/shasantx/sangeet" className="transition hover:text-white">GitHub</Link><a href="https://shasant.xyz" className="font-semibold text-white/80 transition hover:text-primary">Made by Shasant <span aria-hidden="true">↗</span></a></div>
        </div>
      </footer>
    </main>
  );
}
