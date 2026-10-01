import {
    type FormEvent,
    type ReactNode,
    useEffect,
    useState,
} from 'react'
import { useAuth, useClerk, useUser } from '@clerk/react'
import { useProfile } from './useProfile'
import { useTheme } from '@ugotalan2/ui'
import type { AppearanceMode } from './Profile'

import { getValidatedPlatformReturnTo } from '../../utils/platformReturnTo'

type OnboardingGateProps = {
    children: ReactNode
}

function toAppearanceMode(
    preference: 'system' | 'light' | 'dark'
): AppearanceMode {
    switch (preference) {
        case 'light':
            return 'LIGHT'
        case 'dark':
            return 'DARK'
        case 'system':
        default:
            return 'SYSTEM'
    }
}

function OnboardingGate({ children }: OnboardingGateProps) {
    const { isLoaded, isSignedIn } = useAuth()
    const { user } = useUser()
    const clerk = useClerk()
    const { preference } = useTheme()

    const {
        profile,
        loading,
        needsOnboarding,
        createProfile,
    } = useProfile()

    const isExplicitOnboarding = window.location.pathname === '/onboarding'
    const returnTo = getValidatedPlatformReturnTo(
        new URLSearchParams(window.location.search).get('returnTo'),
    )
    const onboardingUrl = window.location.href

    const [name, setName] = useState('')
    const [notificationEmail, setNotificationEmail] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState<string | null>(null)

    useEffect(() => {
        if (isLoaded && !isSignedIn && isExplicitOnboarding) {
            clerk.openSignIn({
                forceRedirectUrl: onboardingUrl,
            })
        }
    }, [clerk, isExplicitOnboarding, isLoaded, isSignedIn, onboardingUrl])

    useEffect(() => {
        if (!user || !needsOnboarding) {
            return
        }

        const clerkName =
            user.fullName ??
            [user.firstName, user.lastName]
                .filter(Boolean)
                .join(' ')

        const clerkEmail =
            user.primaryEmailAddress?.emailAddress ?? ''

        setName(clerkName)
        setNotificationEmail(clerkEmail)
    }, [user, needsOnboarding])

    if (!isLoaded || loading) {
        return <>{children}</>
    }

    if (!isSignedIn) {
        return <>{children}</>
    }

    const clerkName =
        user?.fullName ??
        [user?.firstName, user?.lastName]
            .filter(Boolean)
            .join(' ') ??
        ''

    const clerkEmail =
        user?.primaryEmailAddress?.emailAddress ?? ''

    // A downstream app explicitly requested onboarding, but this Platform
    // Clerk session already belongs to an existing AlanWilliams Apps Person.
    // Do not silently fall through to the Platform home page. Explain the
    // mismatch and let the user sign out locally so /onboarding can present
    // Clerk sign-in for the account they intended to use.
    if (isExplicitOnboarding && !needsOnboarding && profile) {
        async function handleUseDifferentAccount() {
            setSubmitting(true)
            setSubmitError(null)

            try {
                await clerk.signOut({
                    redirectUrl: onboardingUrl,
                })
            } catch (err) {
                setSubmitError(
                    err instanceof Error
                        ? err.message
                        : 'Unable to sign out'
                )
                setSubmitting(false)
            }
        }

        return (
            <div className="container py-5">
                <div className="row justify-content-center">
                    <div className="col-12 col-md-8 col-lg-6">
                        <div className="aw-card p-4">
                            <h1 className="h3 mb-2">
                                You're already signed in
                            </h1>

                            <p className="aw-text-muted mb-4">
                                This account already has an AlanWilliams Apps profile.
                                Did you mean to sign up as someone else?
                            </p>

                            <div className="p-3 rounded border mb-4">
                                <div className="small aw-text-muted mb-1">
                                    You're signed in as
                                </div>

                                {clerkName && (
                                    <div className="fw-semibold">
                                        {clerkName}
                                    </div>
                                )}

                                {clerkEmail && (
                                    <div>{clerkEmail}</div>
                                )}
                            </div>

                            {submitError && (
                                <div
                                    className="alert alert-danger"
                                    role="alert"
                                >
                                    {submitError}
                                </div>
                            )}

                            <button
                                type="button"
                                className="btn aw-btn-accent w-100"
                                onClick={() => void handleUseDifferentAccount()}
                                disabled={submitting}
                            >
                                {submitting
                                    ? 'Signing Out...'
                                    : 'Sign In as Someone Else'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (!needsOnboarding) {
        return <>{children}</>
    }

    const timeZone =
        Intl.DateTimeFormat().resolvedOptions().timeZone

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()

        try {
            setSubmitting(true)
            setSubmitError(null)

            await createProfile({
                name: name.trim(),
                notificationEmail:
                    notificationEmail.trim() || undefined,
                timeZone,
                appearanceMode: toAppearanceMode(preference),
            })

            await user?.reload()
            await clerk.session?.reload()

            if (returnTo) {
                window.location.replace(returnTo)
            }
        } catch (err) {
            setSubmitError(
                err instanceof Error
                    ? err.message
                    : 'Unable to create profile'
            )
        } finally {
            setSubmitting(false)
        }
    }

    async function handleSignOut() {
        if (isExplicitOnboarding) {
            await clerk.signOut({
                redirectUrl: onboardingUrl,
            })
            return
        }

        await clerk.signOut()
    }

    return (
        <div className="container py-5">
            <div className="row justify-content-center">
                <div className="col-12 col-md-8 col-lg-6">
                    <div className="aw-card p-4">
                        <h1 className="h3 mb-2">
                            Create your AlanWilliams Apps profile
                        </h1>

                        <p className="aw-text-muted mb-4">
                            Confirm your profile information to continue.
                        </p>

                        <div className="p-3 rounded border mb-4">
                            <div className="small aw-text-muted mb-1">
                                You're signed in as
                            </div>

                            {clerkName && (
                                <div className="fw-semibold">
                                    {clerkName}
                                </div>
                            )}

                            {clerkEmail && (
                                <div>{clerkEmail}</div>
                            )}
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="mb-3">
                                <label
                                    htmlFor="onboarding-name"
                                    className="form-label"
                                >
                                    Name
                                </label>

                                <input
                                    id="onboarding-name"
                                    type="text"
                                    className="form-control"
                                    value={name}
                                    onChange={(event) =>
                                        setName(event.target.value)
                                    }
                                    maxLength={150}
                                    required
                                    disabled={submitting}
                                />
                            </div>

                            <div className="mb-4">
                                <label
                                    htmlFor="onboarding-email"
                                    className="form-label"
                                >
                                    Notification email
                                </label>

                                <input
                                    id="onboarding-email"
                                    type="email"
                                    className="form-control"
                                    value={notificationEmail}
                                    onChange={(event) =>
                                        setNotificationEmail(
                                            event.target.value
                                        )
                                    }
                                    maxLength={255}
                                    disabled={submitting}
                                />

                                <div className="form-text">
                                    Used for notifications only. Your
                                    sign-in account is managed separately.
                                </div>
                            </div>

                            {submitError && (
                                <div
                                    className="alert alert-danger"
                                    role="alert"
                                >
                                    {submitError}
                                </div>
                            )}

                            <button
                                type="submit"
                                className="btn aw-btn-accent w-100"
                                disabled={submitting || !name.trim()}
                            >
                                {submitting
                                    ? 'Creating Profile...'
                                    : 'Create Profile'}
                            </button>
                        </form>

                        <div className="text-center mt-4">
                            <div className="small aw-text-muted mb-2">
                                Not the account you intended to use?
                            </div>

                            <button
                                type="button"
                                className="btn btn-link"
                                onClick={() => void handleSignOut()}
                                disabled={submitting}
                            >
                                Sign out
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default OnboardingGate
