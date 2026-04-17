-- ============================================================
-- Sync sub account verification status with parent admin account
-- Ensures verified parent admins automatically grant verify badge
-- to all of their sub accounts.
-- ============================================================

CREATE OR REPLACE FUNCTION public.inherit_sub_account_verification_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  inherited_is_verified BOOLEAN := FALSE;
BEGIN
  IF COALESCE(NEW.is_sub_account, FALSE) = FALSE THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_admin_id IS NULL THEN
    NEW.is_verified = FALSE;
    RETURN NEW;
  END IF;

  SELECT COALESCE(parent.is_verified, FALSE)
    INTO inherited_is_verified
  FROM public.profiles AS parent
  WHERE parent.id = NEW.parent_admin_id;

  NEW.is_verified = inherited_is_verified;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inherit_sub_account_verification_status ON public.profiles;
CREATE TRIGGER trg_inherit_sub_account_verification_status
BEFORE INSERT OR UPDATE OF is_sub_account, parent_admin_id, is_verified
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.inherit_sub_account_verification_status();

CREATE OR REPLACE FUNCTION public.propagate_parent_verification_to_sub_accounts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF COALESCE(NEW.is_sub_account, FALSE) = TRUE THEN
    RETURN NEW;
  END IF;

  IF COALESCE(OLD.is_verified, FALSE) IS NOT DISTINCT FROM COALESCE(NEW.is_verified, FALSE) THEN
    RETURN NEW;
  END IF;

  UPDATE public.profiles AS child
  SET is_verified = COALESCE(NEW.is_verified, FALSE)
  WHERE child.is_sub_account = TRUE
    AND child.parent_admin_id = NEW.id
    AND COALESCE(child.is_verified, FALSE) IS DISTINCT FROM COALESCE(NEW.is_verified, FALSE);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_parent_verification_to_sub_accounts ON public.profiles;
CREATE TRIGGER trg_propagate_parent_verification_to_sub_accounts
AFTER UPDATE OF is_verified
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.propagate_parent_verification_to_sub_accounts();

UPDATE public.profiles AS child
SET is_verified = COALESCE(parent.is_verified, FALSE)
FROM public.profiles AS parent
WHERE child.is_sub_account = TRUE
  AND child.parent_admin_id = parent.id
  AND COALESCE(child.is_verified, FALSE) IS DISTINCT FROM COALESCE(parent.is_verified, FALSE);