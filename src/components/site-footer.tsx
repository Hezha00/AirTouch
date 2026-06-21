"use client";

import { Hand, Heart, Mail, Send, Instagram, Globe } from "lucide-react";
import { useI18n } from "@/lib/gesture/i18n-context";

export function SiteFooter() {
  const { t, lang } = useI18n();
  return (
    <footer className="relative mt-auto border-t border-border/50 glass-strong">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <Hand className="h-5 w-5 text-primary" />
              <span className="font-bold text-lg">
                Air<span className="text-gradient">Touch</span>
              </span>
            </div>
            <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
              {t("footer.desc")}
            </p>
          </div>

          {/* creator */}
          <div>
            <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">{t("footer.creator")}</h4>
            <p className="text-base font-bold text-foreground">
              {lang === "fa" ? "هیژا خالدی" : "Hezha Khaledi"}
            </p>
            <div className="mt-3 space-y-1.5">
              <a href="https://t.me/Hezha_kh00" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
                <Send className="h-3.5 w-3.5" /> Hezha_kh00
              </a>
              <a href="https://instagram.com/Hezha_khaledi" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
                <Instagram className="h-3.5 w-3.5" /> Hezha_khaledi
              </a>
              <a href="mailto:hezhakh4@gmail.com" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
                <Mail className="h-3.5 w-3.5" /> hezhakh4@gmail.com
              </a>
            </div>
          </div>

          {/* english-arcade.ir ad */}
          <div>
            <div className="rounded-xl glass p-4 border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">{t("arcade.title")}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mb-2">{t("arcade.desc")}</p>
              <a href="https://english-arcade.ir" target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-primary hover:underline">
                {t("arcade.cta")} →
              </a>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} AirTouch · {t("footer.rights")}
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            {t("footer.built")} <Heart className="h-3 w-3 text-primary fill-primary" /> {t("footer.and")} · Hezha Khaledi
          </p>
        </div>
      </div>
    </footer>
  );
}
