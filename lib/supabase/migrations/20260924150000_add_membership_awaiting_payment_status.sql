-- ============================================================
-- EWUKAI
-- ETAPE 1 - AJOUT DU STATUT D'ADHESION EN ATTENTE DE PAIEMENT
-- ============================================================
--
-- Ce statut est utilisé lorsqu'une demande d'adhésion payante
-- a été acceptée par le bureau mais que le droit d'adhésion
-- n'a pas encore été confirmé comme payé (ou exonéré).
--
-- Important :
-- cette migration ne modifie encore aucune logique d'approbation.
-- Elle ajoute uniquement la valeur d'enum afin de pouvoir
-- l'utiliser proprement dans la migration suivante.
-- ============================================================

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_enum as e
      on e.enumtypid = t.oid
    where
      t.typnamespace = 'public'::regnamespace
      and t.typname = 'membership_application_status'
      and e.enumlabel = 'awaiting_payment'
  ) then
    alter type public.membership_application_status
      add value 'awaiting_payment' after 'pending';
  end if;
end
$$;
