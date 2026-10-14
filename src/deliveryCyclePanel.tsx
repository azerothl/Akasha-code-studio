import { Button } from "./components/ui/button";
import { DELIVERY_STEPS, resolveDeliveryFocus, type DeliveryStepId } from "./deliveryCycle";

type DeliveryTarget = "chat" | "preview" | "branches" | "dashboard";

type Props = {
  hasProject: boolean;
  taskRunning: boolean;
  taskFinished: boolean;
  dirty: boolean;
  hasEvolution: boolean;
  verifyRan: boolean;
  onStep: (step: DeliveryStepId, target: DeliveryTarget) => void;
};

function targetFor(step: DeliveryStepId, hasProject: boolean): DeliveryTarget {
  if (!hasProject) return "dashboard";
  switch (step) {
    case "ask":
    case "follow":
    case "review":
      return "chat";
    case "verify":
      return "preview";
    case "merge":
      return "branches";
    default: {
      const unreachable: never = step;
      return unreachable;
    }
  }
}

export function DeliveryCycle(props: Props) {
  const focus = resolveDeliveryFocus(props);
  return (
    <section className="delivery-cycle" aria-label="Cycle de livraison">
      <div className="delivery-cycle-steps">
        {DELIVERY_STEPS.map((step) => {
          const current = step.id === focus.current;
          return (
            <Button
              key={step.id}
              type="button"
              size="sm"
              variant={current ? "default" : "secondary"}
              className={`delivery-cycle-step ${current ? "is-current" : ""}`}
              aria-current={current ? "step" : undefined}
              onClick={() => props.onStep(step.id, targetFor(step.id, props.hasProject))}
            >
              {step.label}
            </Button>
          );
        })}
      </div>
      <p className="hint delivery-cycle-next">
        Prochaine action : {focus.next}
      </p>
    </section>
  );
}
