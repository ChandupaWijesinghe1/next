class EmailAlreadyRegisteredError(Exception):#Raised when a user tries to register with an email that is already registered.
    def __init__(self, message: str = "Email already registered"):
        self.message = message
        super().__init__(message)


class InvalidCredentialsError(Exception):#Raised when a user tries to login with invalid credentials.
    def __init__(self, message: str = "Invalid credentials"):
        self.message = message
        super().__init__(message)


class InvalidTokenError(Exception):#Raised when a user tries to use an invalid or expired token.
    def __init__(self, message: str = "Invalid or expired token"):
        self.message = message
        super().__init__(message)


class RateLimitExceededError(Exception):#Raised when a user tries to exceed the rate limit.
    def __init__(
        self,
        retry_after: int,
        message: str = "Too many requests. Please try again later.",
    ):
        self.retry_after = retry_after
        self.message = message
        super().__init__(message)


class ForbiddenError(Exception): #Raised when a user tries to access a resource they don't have permission to.
    def __init__(self, message: str = "Forbidden"):
        self.message = message
        super().__init__(message)


class NotFoundError(Exception):
    def __init__(self, message: str = "Not found"):
        self.message = message
        super().__init__(message)


class OAuthError(Exception):#Raised when OAuth authentication fails.
    def __init__(self, message: str = "OAuth authentication failed"):
        self.message = message
        super().__init__(message)


class AttachmentValidationError(Exception):#Raised when an attachment is invalid.
    def __init__(self, message: str = "Invalid attachment"):
        self.message = message
        super().__init__(message)


class WebhookSignatureError(Exception):#Raised when a webhook signature is invalid.
    def __init__(self, message: str = "Invalid webhook signature"):
        self.message = message
        super().__init__(message)
