"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type Step = 1 | 2 | 3;

export default function RegisterPage() {
  const [step, setStep] = useState<Step>(1);

  // Step 1 fields
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Step 2 fields
  const [dealershipName, setDealershipName] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [location, setLocation] = useState("");
  const [monthlyBudget, setMonthlyBudget] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signUp, user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && user && step === 1) {
      router.push("/");
    }
  }, [user, authLoading, router, step]);

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      await signUp(email, password);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register");
    } finally {
      setLoading(false);
    }
  };

  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const clientId = dealershipName
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: dealershipName,
          access_code: accessCode,
          phone,
          website,
          location,
          contact_name: contactName,
          monthly_budget: monthlyBudget,
          client_id: clientId,
          ad_account_id: "pending",
          access_token: "pending",
          whatsapp: false,
        }),
      });
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit dealership info");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-border border-t-accent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const steps = [
    { label: "Account" },
    { label: "Dealership" },
    { label: "Facebook" },
  ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Title */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-foreground mb-1">OptimAi CRM</h1>
          <p className="text-muted-foreground text-sm">
            {step === 1 && "Create your account"}
            {step === 2 && "Tell us about your dealership"}
            {step === 3 && "Connect your Facebook account"}
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center mb-8 gap-0">
          {steps.map((s, i) => {
            const num = i + 1 as Step;
            const completed = step > num;
            const active = step === num;
            return (
              <div key={num} className="flex items-center">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                      completed
                        ? "bg-accent text-accent-foreground"
                        : active
                        ? "bg-accent text-accent-foreground"
                        : "bg-secondary text-muted-foreground border border-border"
                    }`}
                  >
                    {completed ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      num
                    )}
                  </div>
                  <span className={`text-xs ${active || completed ? "text-foreground" : "text-muted-foreground"}`}>
                    {s.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={`h-px w-12 mx-2 mb-5 transition-colors ${
                      step > num ? "bg-accent" : "bg-border"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Step 1: Account creation */}
        {step === 1 && (
          <form onSubmit={handleStep1} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="contactName" className="text-sm font-medium text-foreground">
                Full Name
              </label>
              <input
                id="contactName"
                type="text"
                placeholder="Jane Smith"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                required
                className="w-full h-10 px-4 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-accent transition-all duration-200"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full h-10 px-4 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-accent transition-all duration-200"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full h-10 px-4 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-accent transition-all duration-200"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full h-10 px-4 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-accent transition-all duration-200"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-medium h-10"
            >
              {loading ? "Creating account..." : "Continue"}
            </Button>

            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" className="text-accent hover:text-accent/80 font-medium transition-colors">
                  Sign in
                </Link>
              </p>
            </div>
          </form>
        )}

        {/* Step 2: Dealership info */}
        {step === 2 && (
          <form onSubmit={handleStep2} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="dealershipName" className="text-sm font-medium text-foreground">
                Dealership Name <span className="text-red-500">*</span>
              </label>
              <input
                id="dealershipName"
                type="text"
                placeholder="Acme Motors"
                value={dealershipName}
                onChange={(e) => setDealershipName(e.target.value)}
                required
                className="w-full h-10 px-4 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-accent transition-all duration-200"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="accessCode" className="text-sm font-medium text-foreground">
                Dealership Access Code (if joining existing dealership - leave empty if registering new dealership)
              </label>
              <input
                id="accessCode"
                type="text"
                placeholder=""
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                className="w-full h-10 px-4 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-accent transition-all duration-200"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="phone" className="text-sm font-medium text-foreground">
                Phone
              </label>
              <input
                id="phone"
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-10 px-4 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-accent transition-all duration-200"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="website" className="text-sm font-medium text-foreground">
                Website
              </label>
              <input
                id="website"
                type="text"
                placeholder="https://yourdealership.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full h-10 px-4 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-accent transition-all duration-200"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="location" className="text-sm font-medium text-foreground">
                Location
              </label>
              <input
                id="location"
                type="text"
                placeholder="City, State"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full h-10 px-4 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-accent transition-all duration-200"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="monthlyBudget" className="text-sm font-medium text-foreground">
                Monthly Budget
              </label>
              <input
                id="monthlyBudget"
                type="text"
                placeholder="$5,000"
                value={monthlyBudget}
                onChange={(e) => setMonthlyBudget(e.target.value)}
                className="w-full h-10 px-4 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-accent transition-all duration-200"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-medium h-10"
            >
              {loading ? "Saving..." : "Continue"}
            </Button>
          </form>
        )}

        {/* Step 3: Connect Facebook */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-secondary border border-border text-sm text-muted-foreground">
              Connect your Facebook account to enable ad syncing and lead management.
            </div>

            <Button
              onClick={() => router.push(`/api/auth/facebook?userId=${user?.id}`)}
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-medium h-10 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              Connect Facebook
            </Button>

            <Button
              variant="outline"
              onClick={() => router.push("/")}
              className="w-full border-border text-foreground hover:bg-secondary font-medium h-10"
            >
              Skip for now
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
